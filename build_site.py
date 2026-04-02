#!/usr/bin/env python3
"""Build static study website from OCR JSON data."""

import json, re, os

# ── Constants ──────────────────────────────────────────────────────────────────

HEADER_RE = re.compile(r'信息系统项目管理师考试重点考点汇总')
FOOTER_RE = re.compile(r'91\s*过软考教育学院内部资料')
CHAPTER_HEAD_RE = re.compile(r'^(前言|第[一二三四五六七八九十百]+章)\s*[　\s]*(.*?)$')

YEAR_COLS   = ['2023年5月', '2023年11月', '2024年', '2025年']
KAO_ROWS_RE = re.compile(r'上午选择题|[案紫茉苯][例例]分析题|例分析题|论文写作|合计')
H1_RE       = re.compile(r'^第[一二三四五六七八九十百]+章')
H2_RE       = re.compile(r'^[一二三四五六七八九十]+[、．.]|^【.*?】')
LIST_RE     = re.compile(r'^(\d+[、．]\s*\S|（\d+）|[①②③④⑤⑥⑦⑧⑨⑩]|[•·※])')
NEW_BLOCK_RE = re.compile(
    r'^('
    r'第[一二三四五六七八九十百]+章'
    r'|[一二三四五六七八九十]+[、．]'
    r'|\d+[、．]\s*\S'
    r'|（\d+）'
    r'|【.*?】'
    r'|[①②③④⑤⑥⑦⑧⑨⑩]'
    r'|[•·※＊★◆▶]'
    r'|注[：:]'
    r'|[A-Z]{2,}[-—\s]'
    r')'
)
END_PUNCT = set('。！？…；）】』"')


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

# ── Chapter detection ──────────────────────────────────────────────────────────

def clean_lines(text):
    result = []
    for line in text.split('\n'):
        line = line.strip()
        if not line: continue
        if HEADER_RE.search(line): continue
        if FOOTER_RE.search(line): continue
        if re.fullmatch(r'\d{3,}', line): continue  # 3+ digit page numbers (100, 107…)
        result.append(line)
    return result

def detect_chapters(pages):
    chapters = []
    for page in pages:
        if page['page'] <= 3: continue
        lines = clean_lines(page['text'])
        if lines:
            m = CHAPTER_HEAD_RE.match(lines[0])
            if m:
                num, title = m.group(1), m.group(2).strip()
                chapters.append({
                    'num': num,
                    'title': f"{num} {title}".strip() if title else num,
                    'startPage': page['page']
                })
    return chapters

def assign_chapters(pages, chapters):
    chapter_map = {}
    for i, ch in enumerate(chapters):
        end = chapters[i+1]['startPage'] if i+1 < len(chapters) else 99999
        for p in range(ch['startPage'], end):
            chapter_map[p] = i
    return [{'page': p['page'], 'chapterIdx': chapter_map.get(p['page'], 0), 'text': p['text']}
            for p in pages]

# ── Table extraction (on raw lines, before reflow) ────────────────────────────

def build_kaofenxi_table(lines):
    """
    Reconstruct 考情分析 table.
    Known structure: rows = 上午选择题 / 案例分析题 / 论文写作 / 合计
                     cols = 2023年5月 / 2023年11月 / 2024年 / 2025年
    """
    found_years = [y for y in YEAR_COLS if any(y in l for l in lines)]
    if len(found_years) < 2:
        return None

    row_labels, seen = [], set()
    for l in lines:
        m = KAO_ROWS_RE.search(l)
        if m:
            label = m.group()
            if label not in seen:
                row_labels.append(label)
                seen.add(label)
    if not row_labels:
        return None

    # Data tokens: short lines (≤ 20 chars) that are NOT structural labels
    skip_set = set(found_years) | seen | {'年份', '本章考情分析', '本章学习建议'}
    data = [l.strip() for l in lines
            if l.strip() and len(l.strip()) <= 20
            and not any(s in l for s in skip_set)]

    ncols = len(found_years)
    html = ['<table class="t-kaofenxi">',
            '<thead><tr><th>科目</th>' + ''.join(f'<th>{esc(y)}</th>' for y in found_years) + '</tr></thead>',
            '<tbody>']
    di = 0
    for label in row_labels:
        cells = [data[di + k] if di + k < len(data) else '—' for k in range(ncols)]
        di += ncols
        html.append('<tr><td><strong>' + esc(label) + '</strong></td>' +
                    ''.join(f'<td>{esc(c)}</td>' for c in cells) + '</tr>')
    html += ['</tbody></table>']
    return '\n'.join(html)


def build_def_table(header1, header2, pairs):
    """
    Build a 2-column definition HTML table.
    Only use pairs where one item is clearly short (label) and one clearly long (desc).
    Skip ambiguous pairs. Return None if fewer than 2 clean pairs.
    """
    clean = []
    for a, b in pairs:
        la, lb = len(a), len(b)
        if la <= 18 and lb > 18:
            clean.append((a, b))
        elif lb <= 18 and la > 18:
            clean.append((b, a))
        # else: ambiguous lengths — skip this pair
    if len(clean) < 2:
        return None
    rows = [f'<table class="t-def">',
            f'<thead><tr><th>{esc(header1)}</th><th>{esc(header2)}</th></tr></thead>',
            '<tbody>']
    for label, desc in clean:
        rows.append(f'<tr><td><strong>{esc(label)}</strong></td><td>{esc(desc)}</td></tr>')
    rows += ['</tbody></table>']
    return '\n'.join(rows)


# A "token" in our intermediate representation
# type: 'line' | 'table_html' | 'raw_block'
def segment_lines(lines):
    """
    Walk raw lines, extract table regions, return list of segments:
      {'type': 'line',       'text': str}
      {'type': 'table_html', 'html': str}
      {'type': 'raw_block',  'lines': [str]}
    """
    segments = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # ── 考情分析 table ─────────────────────────────────────────────────
        if '本章考情分析' in line:
            # Collect year headers + row labels + score cells.
            # "本章学习建议：" often appears mid-block due to OCR column order — include but skip.
            block = [line]
            j = i + 1
            while j < len(lines):
                l = lines[j]
                is_year    = any(y in l for y in YEAR_COLS)
                is_label   = bool(KAO_ROWS_RE.search(l))
                is_score   = bool(re.fullmatch(r'[\d分左右（）批次~\-—\s第]+', l) and len(l) <= 20)
                is_header  = l in ('年份',)
                is_suggest = '本章学习建议' in l   # include, but skip when building table
                if not (is_year or is_label or is_score or is_header or is_suggest):
                    break
                block.append(l)
                j += 1
            html = build_kaofenxi_table(block)
            if html:
                segments.append({'type': 'table_html', 'html': html})
            else:
                for bl in block:
                    segments.append({'type': 'line', 'text': bl})
            i = j
            continue

        # ── 2-column definition table ──────────────────────────────────────
        # Header pattern: two short consecutive lines (≤14 chars, no end punctuation)
        if (i + 3 < len(lines)
                and len(line) <= 14 and line and line[-1] not in '。！？；，'
                and len(lines[i+1]) <= 14 and lines[i+1] and lines[i+1][-1] not in '。！？；，'
                and not H1_RE.match(line) and not H2_RE.match(line)):

            h1, h2 = line, lines[i+1]
            # Collect candidate block: stop at major heading or very long line
            j = i + 2
            cand = []
            while j < len(lines):
                l = lines[j]
                if H1_RE.match(l) or H2_RE.match(l) or '本章考情分析' in l or len(l) > 100:
                    break
                cand.append(l)
                j += 1

            # Build rows: a row starts with a SHORT label (≤18 chars, not ending with sentence punctuation),
            # followed by one or more LONGER description lines.
            # Short lines ending with 。！？ etc. are sentence fragments from description wrap, not labels.
            SENT_END = set('。！？；，、')
            pairs = []
            ci = 0
            while ci < len(cand):
                label_line = cand[ci]
                is_label_candidate = (len(label_line) <= 18
                                      and (not label_line or label_line[-1] not in SENT_END))
                if not is_label_candidate:
                    ci += 1
                    continue   # skip orphan fragment before first label
                # Collect description: all following lines until next short non-fragment label
                desc_parts = []
                ci += 1
                while ci < len(cand):
                    l = cand[ci]
                    next_is_label = (len(l) <= 18 and (not l or l[-1] not in SENT_END))
                    if next_is_label:
                        break
                    desc_parts.append(l)
                    ci += 1
                if desc_parts:
                    pairs.append((label_line, ''.join(desc_parts)))

            if len(pairs) >= 2:
                html = build_def_table(h1, h2, pairs)
                if html:
                    segments.append({'type': 'table_html', 'html': html})
                    i = j
                    continue

        segments.append({'type': 'line', 'text': line})
        i += 1

    return segments

# ── Paragraph reflow ───────────────────────────────────────────────────────────

def is_standalone(line):
    return len(line) <= 8 and (not line or line[-1] not in '，,、（【')

def reflow(lines):
    if not lines: return []
    result, buf = [], lines[0]
    for line in lines[1:]:
        prev_end = (buf[-1] in END_PUNCT) if buf else True
        next_block = bool(NEW_BLOCK_RE.match(line))
        if prev_end or next_block or is_standalone(buf) or is_standalone(line):
            result.append(buf)
            buf = line
        else:
            buf += line
    result.append(buf)
    return result

# ── Line → HTML ───────────────────────────────────────────────────────────────

def line_to_html(line):
    e = esc(line)
    if H1_RE.match(line):   return f'<h2>{e}</h2>'
    if H2_RE.match(line):   return f'<h3>{e}</h3>'
    if LIST_RE.match(line): return f'<li>{e}</li>'
    return f'<p>{e}</p>'

def wrap_lists(html):
    return re.sub(r'((?:<li>.*?</li>\n?)+)', r'<ul>\1</ul>', html, flags=re.S)

# ── Full page processor ────────────────────────────────────────────────────────

def process_page(text):
    raw = clean_lines(text)
    segments = segment_lines(raw)

    plain_parts = []
    html_parts  = []

    # Collect consecutive 'line' segments, reflow them, then emit
    line_buf = []

    def flush_lines():
        if not line_buf: return
        reflowed = reflow(line_buf)
        plain_parts.append('\n'.join(reflowed))
        html_parts.append('\n'.join(line_to_html(l) for l in reflowed))
        line_buf.clear()

    for seg in segments:
        if seg['type'] == 'line':
            line_buf.append(seg['text'])
        else:
            flush_lines()
            if seg['type'] == 'table_html':
                # Also add plain-text version for search
                plain_parts.append(re.sub(r'<[^>]+>', ' ', seg['html']))
                html_parts.append(seg['html'])
            elif seg['type'] == 'raw_block':
                plain_parts.append('\n'.join(seg['lines']))
                html_parts.append('<div class="t-raw">' +
                    '<br>'.join(esc(l) for l in seg['lines']) + '</div>')

    flush_lines()

    plain = '\n'.join(plain_parts)
    html  = wrap_lists('\n'.join(html_parts))
    return plain, html

# ── Build data.js ──────────────────────────────────────────────────────────────

def build_data_js(pages, chapters):
    processed = []
    for p in pages:
        plain, html = process_page(p['text'])
        processed.append({'page': p['page'], 'chapterIdx': p['chapterIdx'],
                           'text': plain, 'html': html})
    data = {'chapters': chapters, 'pages': processed}
    return f"const STUDY_DATA = {json.dumps(data, ensure_ascii=False)};"

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("Loading OCR data...")
    with open('ocr_full_output.json', encoding='utf-8') as f:
        raw_pages = json.load(f)
    print(f"Loaded {len(raw_pages)} pages")

    print("Detecting chapters...")
    chapters = detect_chapters(raw_pages)
    print(f"Found {len(chapters)} chapters")

    print("Assigning chapters...")
    pages = assign_chapters(raw_pages, chapters)

    print("Processing & generating data.js...")
    os.makedirs('site', exist_ok=True)
    js = build_data_js(pages, chapters)
    with open('site/data.js', 'w', encoding='utf-8') as f:
        f.write(js)

    size_kb = os.path.getsize('site/data.js') / 1024
    print(f"Done — data.js: {size_kb:.0f} KB")

if __name__ == '__main__':
    main()

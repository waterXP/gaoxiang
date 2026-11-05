#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按 book-001 的排版与编码规则，把《信息系统项目管理师案例背诵.html》重建为 book-002。

book-001 规则（本项目统一排版 / 编码约定）：
  - 所有页面 type 统一为 "普通"（无彩色角标 / 无左边框 / 无底色）
  - meta.num = 第一章…；meta.title = "第一章 XXX"；startPage = 连续页码
  - 每章首页以 "h2:第X章 XXX" 开头，各考点用 "h3:"
  - 段落使用裸字符串（不加 txt: 前缀）
  - 表格使用对象格式 { headers: [...], rows: [[...]] }
  - 图片使用 import + `img:${var}`
"""
import base64
import json
import os
import re
import shutil

HTML = '/Users/chenwenjie/Downloads/27年内部核心资料及代打印地址/信息系统项目管理师案例背诵.html'
ROOT = '/Users/chenwenjie/Projects/gaoxiang'
OUT = os.path.join(ROOT, 'app/src/data/books/book-002')

CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
      '十一', '十二', '十三', '十四', '十五']


def cn_num(n):
    return CN[n] if 0 <= n < len(CN) else str(n)


def js_str(s):
    return json.dumps(s, ensure_ascii=False)


def norm_title(s):
    return re.sub(r'[：:。\s…]+$', '', (s or '').strip())


def clean_chapter_title(title):
    return re.sub(r'^[（(]\s*\d+\s*[）)]\s*', '', (title or '')).strip()


# 并列条目：①②③… 或 （1）（2）…
CIRCLED_RE = re.compile(r'^[①-⑳]')
PAREN_NUM_RE = re.compile(r'^[（(]\s*\d+\s*[）)]')
CELL_BULLET = '●'


def is_list_line(s):
    return bool(CIRCLED_RE.match(s) or PAREN_NUM_RE.match(s))


def split_cell(cell):
    """表格单元格里用 ● 并列的条目，拆成数组（渲染成 <ul>）。"""
    if isinstance(cell, str) and CELL_BULLET in cell:
        parts = [p.strip() for p in cell.split(CELL_BULLET)]
        parts = [p for p in parts if p]
        if len(parts) >= 2:
            return parts
    return cell


def _is_short(s, limit=12):
    return len(s) <= limit


def merge_row(cells):
    """同一行里相邻且完全相同的单元格 → 合并成一个 cols-N 单元格（去掉重复）。"""
    out = []
    i = 0
    n = len(cells)
    while i < n:
        c = cells[i]
        if isinstance(c, str) and c:
            k = i
            while k + 1 < n and cells[k + 1] == c:
                k += 1
            span = k - i + 1
            out.append(('cols-%d:' % span if span > 1 else '') + c)
            i = k + 1
        else:
            out.append(c)
            i += 1
    return out


CELL_MODS = {'im', 'hi', 'bold', 'left', 'center', 'right'}


def mark_first_cell(row):
    """正文行第一列统一标红（im:）；表头不动。"""
    if not row:
        return row
    c = row[0]
    if not isinstance(c, str) or not c:
        return row
    head = c.split(':', 1)[0] if ':' in c else c
    parts = head.split('/')
    if 'im' in parts:
        return row
    is_mod = any(re.fullmatch(r'(cols|rows)-\d+', p) for p in parts) or any(p in CELL_MODS for p in parts)
    if is_mod and ':' in c:
        h, b = c.split(':', 1)
        return ['im/' + h + ':' + b] + list(row[1:])
    return ['im:' + c] + list(row[1:])


def build_two_tier(row0, row1):
    """把「分组行 + 子表头行」压成二维表头。

    返回 [top_row, bottom_row]；不是两层表头则返回 None。
    - 同一列上下两行文字相同 → 纵向合并 rows-2
    - 首行连续相同的分组标签   → 横向合并 cols-N
    """
    if len(row0) != len(row1) or len(row0) < 2:
        return None
    if not all(_is_short(c) for c in row1):
        return None
    if len(set(row0)) == len(row0):      # 首行没有重复 → 不是分组表头
        return None
    top, bottom = [], []
    j = 0
    n = len(row0)
    while j < n:
        if row0[j] == row1[j]:
            top.append('rows-2:' + row0[j])
            j += 1
            continue
        k = j
        while k + 1 < n and row0[k + 1] == row0[j] and row1[k + 1] != row0[j]:
            k += 1
        span = k - j + 1
        top.append(('cols-%d:' % span if span > 1 else '') + row0[j])
        bottom.extend(row1[j:k + 1])
        j = k + 1
    if not bottom:
        return None
    return [top, bottom]


def load_data():
    raw = open(HTML, encoding='utf-8').read()
    i = raw.index('const EXAM_DATA = ')
    j = raw.index('</script>', i)
    body = raw[i + len('const EXAM_DATA = '):j].strip()
    obj, _ = json.JSONDecoder().raw_decode(body)
    return obj


def parse_table(lines, start):
    rows = []
    k = start
    while k < len(lines) and lines[k].strip().startswith('|'):
        s = lines[k].strip()
        s = re.sub(r'^\|', '', s)
        s = re.sub(r'\|$', '', s)
        cells = []
        for c in s.split('|'):
            c = c.strip()
            if '[[IMG:' in c:
                raise SystemExit('图片出现在表格单元格内，需特殊处理: ' + c)
            cells.append(split_cell(c))
        rows.append(cells)
        k += 1
    return rows, k


def parse_answer(qa):
    """把 answer_text 解析为 content items（1:1 保留原文，不做删减）。

    item 形式：
      {'kind': 'text', 'value': '...'}
      {'kind': 'ul',   'items': [...]}
      {'kind': 'img',  'name': 'image1.png'}
      {'kind': 'table', 'headers': [...], 'rows': [[...]]}
      {'kind': 'rows',  'headers': None,  'rows': [[...]]}
    """
    lines = qa['answer_text'].split('\n')
    items = []
    i = 0
    n = len(lines)
    while i < n:
        s = lines[i].strip()
        if s.startswith('|'):
            rows, i = parse_table(lines, i)
            if len(rows) >= 2:
                tier = build_two_tier(rows[0], rows[1])
                if tier:
                    items.append({'kind': 'table', 'headers': tier,
                                  'rows': [mark_first_cell(merge_row(r)) for r in rows[2:]]})
                else:
                    items.append({'kind': 'table', 'headers': merge_row(rows[0]),
                                  'rows': [mark_first_cell(merge_row(r)) for r in rows[1:]]})
            elif rows:
                items.append({'kind': 'rows', 'headers': None,
                              'rows': [mark_first_cell(merge_row(r)) for r in rows]})
            continue
        if '[[IMG:' in s:
            for part in re.split(r'(\[\[IMG:[^\]]+\]\])', s):
                if not part:
                    continue
                m = re.fullmatch(r'\[\[IMG:([^\]]+)\]\]', part)
                if m:
                    items.append({'kind': 'img', 'name': m.group(1)})
                elif part.strip():
                    items.append({'kind': 'text', 'value': part.strip()})
            i += 1
            continue
        if s:
            # 连续的并列条目（①②③ / （1）（2））合并成数组，渲染成 <ul>
            if is_list_line(s):
                group = [s]
                k = i + 1
                while k < n:
                    t = lines[k].strip()
                    if t and is_list_line(t):
                        group.append(t)
                        k += 1
                    else:
                        break
                if len(group) >= 2:
                    items.append({'kind': 'ul', 'items': group})
                    i = k
                    continue
            items.append({'kind': 'text', 'value': s})
        i += 1
    return items


def serialize_items(items, var_of, indent='      '):
    out = []
    for it in items:
        if it['kind'] == 'text':
            out.append(f'{indent}{js_str(it["value"])},')
        elif it['kind'] == 'img':
            out.append(f'{indent}`img:${{{var_of[it["name"]]}}}`,')
        elif it['kind'] == 'ul':
            out.append(f'{indent}[')
            for x in it['items']:
                out.append(f'{indent}  {js_str(x)},')
            out.append(f'{indent}],')
        else:
            out.append(f'{indent}{{')
            if it['headers'] is not None:
                out.append(f'{indent}  headers: [' + ', '.join(
                    js_str(c) for c in it['headers']) + '],')
            out.append(f'{indent}  rows: [')
            for row in it['rows']:
                out.append(f'{indent}    [' + ', '.join(js_str(c) for c in row) + '],')
            out.append(f'{indent}  ],')
            out.append(f'{indent}}},')
    return out


def main():
    obj = load_data()

    imgs_dir = os.path.join(OUT, 'imgs')
    if os.path.isdir(imgs_dir):
        shutil.rmtree(imgs_dir)
    os.makedirs(imgs_dir, exist_ok=True)
    chapters_dir = os.path.join(OUT, 'chapters')
    os.makedirs(chapters_dir, exist_ok=True)

    pdf_imgs = obj['imgs']

    meta = []
    index_imports = []
    index_pages = []
    total = 0

    for ch in obj['chapters']:
        cid = ch['id']
        cn = cn_num(cid)
        title = '第%s章 %s' % (cn, clean_chapter_title(ch['title']))

        pages = []
        for idx, qa in enumerate(ch['qas']):
            total += 1
            # 按章从 1 编号（原页面就是 1..N 题，不跨章累计）
            page_no = qa['number']
            qd = (qa.get('question_display') or qa.get('question_short') or qa['question']).strip()
            items = parse_answer(qa)

            if idx == 0:
                items.insert(0, {'kind': 'text', 'value': 'h2:' + title})
                items.insert(1, {'kind': 'text', 'value': 'h3:' + qd})
            else:
                items.insert(0, {'kind': 'text', 'value': 'h3:' + qd})
            pages.append({'page': page_no, 'items': items})

        # 本章图片变量名（按首次出现顺序）
        seq = 0
        img_seq = {}
        for p in pages:
            for it in p['items']:
                if it['kind'] == 'img' and it['name'] not in img_seq:
                    seq += 1
                    img_seq[it['name']] = seq
        var_of = {name: f'ch{cid}_{s}' for name, s in img_seq.items()}

        # 写出图片
        for name, s in img_seq.items():
            raw = base64.b64decode(pdf_imgs[name].split(',', 1)[1])
            with open(os.path.join(imgs_dir, f'ch_{cid}_{s}.png'), 'wb') as f:
                f.write(raw)

        # 组装章节文件
        lines = []
        for name, s in img_seq.items():
            lines.append(f'import ch{cid}_{s} from "../imgs/ch_{cid}_{s}.png";')
        if lines:
            lines.append('')
        lines.append('export default [')
        for p in pages:
            lines.append('  {')
            lines.append(f'    page: {p["page"]},')
            lines.append('    type: "普通",')
            lines.append('    content: [')
            lines.extend(serialize_items(p['items'], var_of))
            lines.append('    ],')
            lines.append('  },')
        lines.append('];')
        lines.append('')
        with open(os.path.join(chapters_dir, f'ch_{cid:02d}.js'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        meta.append({'num': '第%s章' % cn, 'title': title, 'startPage': 1})
        index_imports.append(f'import ch{cid:02d} from "./chapters/ch_{cid:02d}.js";')
        index_pages.append(f'  ch{cid:02d},')

    # meta.js
    mlines = ['export const chapters = [']
    for m in meta:
        mlines.append('  {')
        mlines.append(f'    "num": {js_str(m["num"])},')
        mlines.append(f'    "title": {js_str(m["title"])},')
        mlines.append(f'    "startPage": {m["startPage"]}')
        mlines.append('  },')
    mlines.append('];')
    mlines.append('')
    with open(os.path.join(OUT, 'meta.js'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(mlines))

    # index.js
    ilines = index_imports + ['', 'export const allChapterPages = [']
    ilines += index_pages
    ilines.append('];')
    ilines.append('')
    with open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(ilines))

    # info.js
    with open(os.path.join(OUT, 'info.js'), 'w', encoding='utf-8') as f:
        f.write("export default {\n"
                "  id: 'book-002',\n"
                "  title: '案例背诵',\n"
                "  subtitle: '信息系统项目管理师 · %d 个背诵考点',\n"
                "};\n" % total)

    print('章节数:', len(meta), '总考点:', total)
    print('图片:', sorted(os.listdir(imgs_dir)))


if __name__ == '__main__':
    main()

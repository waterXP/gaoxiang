#!/usr/bin/env node
// split_data.js — Splits data.js into per-chapter files, converts to content arrays,
//                 creates info.js, and regenerates books.js
//
// Usage:
//   node split_data.js [book_id] [title] [subtitle]
//
// Examples:
//   node split_data.js                                          # book-001, uses existing info.js
//   node split_data.js book-002 "系统分析师" "2026 重点汇总"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bookId   = process.argv[2] || 'book-001';
const title    = process.argv[3];
const subtitle = process.argv[4];

const dataPath = path.join(__dirname, `site/data_${bookId}.js`);
const bookDir  = path.join(__dirname, `app/src/data/books/${bookId}`);
const outDir   = path.join(bookDir, 'chapters');

console.log(`Book:   ${bookId}`);
console.log(`Input:  site/data_${bookId}.js\n`);

// ── Load data.js ──────────────────────────────────────────────────
const content = fs.readFileSync(dataPath, 'utf8');
const fn = new Function(content + '\nreturn STUDY_DATA;');
const { chapters, pages } = fn();

// Group pages by chapterIdx
const pagesByChapter = {};
for (const p of pages) {
  const idx = p.chapterIdx ?? 0;
  if (!pagesByChapter[idx]) pagesByChapter[idx] = [];
  pagesByChapter[idx].push(p);
}

// ── html → content array conversion ──────────────────────────────

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

function parseInline(raw) {
  const text = decodeEntities(raw.trim())
  if (!text.includes('<strong>')) return { text }
  const parts = []
  const re = /(<strong>)([\s\S]*?)(<\/strong>)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ text: m[2], bold: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  if (parts.length === 1 && parts[0].bold) return { text: parts[0].text, bold: true }
  return { parts }
}

function stripTags(s) { return decodeEntities(s.replace(/<[^>]+>/g, '')) }

function parseUl(inner) {
  const items = []
  const liRe = /<li>([\s\S]*?)<\/li>/g
  let m
  while ((m = liRe.exec(inner)) !== null) {
    const parsed = parseInline(m[1])
    items.push(parsed.parts ? parsed : parsed.bold ? { text: parsed.text, bold: true } : { text: parsed.text })
  }
  return { tag: 'ul', items }
}

function parseTable(inner) {
  const headers = [], rows = []
  const theadM = inner.match(/<thead>([\s\S]*?)<\/thead>/)
  const tbodyM = inner.match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (theadM) {
    const thRe = /<th>([\s\S]*?)<\/th>/g
    let m
    while ((m = thRe.exec(theadM[1])) !== null) {
      const p = parseInline(m[1])
      headers.push(p.parts ? p : p.bold ? { text: p.text, bold: true } : { text: p.text })
    }
  }
  if (tbodyM) {
    const trRe = /<tr>([\s\S]*?)<\/tr>/g
    let trM
    while ((trM = trRe.exec(tbodyM[1])) !== null) {
      const row = []
      const tdRe = /<td>([\s\S]*?)<\/td>/g
      let tdM
      while ((tdM = tdRe.exec(trM[1])) !== null) {
        const p = parseInline(tdM[1])
        row.push(p.parts ? p : p.bold ? { text: p.text, bold: true } : { text: p.text })
      }
      if (row.length) rows.push(row)
    }
  }
  const block = { tag: 'table', rows }
  if (headers.length) block.headers = headers
  return block
}

function parseHtml(html) {
  const content = []
  const re = /<(h2|h3|p|ul|table)(\s[^>]*)?>[\s\S]*?<\/\1>/g
  let m
  while ((m = re.exec(html)) !== null) {
    const tag = m[1], full = m[0]
    if (tag === 'h2' || tag === 'h3') {
      content.push({ tag, text: stripTags(full.replace(/<\/?(?:h2|h3)[^>]*>/g, '')) })
    } else if (tag === 'p') {
      const inner = full.replace(/<\/?p[^>]*>/g, '')
      const parsed = parseInline(inner)
      const block = { tag: 'p' }
      if (parsed.parts) block.parts = parsed.parts
      else { block.text = parsed.text; if (parsed.bold) block.bold = true }
      content.push(block)
    } else if (tag === 'ul') {
      content.push(parseUl(full.replace(/^<ul[^>]*>|<\/ul>$/g, '')))
    } else if (tag === 'table') {
      content.push(parseTable(full.replace(/^<table[^>]*>|<\/table>$/g, '')))
    }
  }
  return content
}

function convertFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8')
  let result = '', i = 0, converted = 0
  const marker = 'html: `'
  while (i < src.length) {
    const idx = src.indexOf(marker, i)
    if (idx === -1) { result += src.slice(i); break }
    const lineStart = src.lastIndexOf('\n', idx) + 1
    if (src.slice(lineStart, idx).trimStart().startsWith('//')) {
      result += src.slice(i, idx + marker.length)
      i = idx + marker.length
      continue
    }
    result += src.slice(i, idx)
    i = idx + marker.length
    let htmlContent = ''
    while (i < src.length) {
      if (src[i] === '\\' && i + 1 < src.length) {
        htmlContent += src[i + 1] === '`' ? '`' : src[i] + src[i + 1]
        i += 2
      } else if (src[i] === '`') { i++; break }
      else htmlContent += src[i++]
    }
    const contentArr = parseHtml(htmlContent)
    if (contentArr.length === 0) {
      const escaped = htmlContent.replace(/`/g, '\\`').replace(/\${/g, '\\${')
      result += `html: \`${escaped}\``
    } else {
      result += 'content: [\n' + contentArr.map(b => '    ' + JSON.stringify(b) + ',').join('\n') + '\n  ]'
      converted++
    }
  }
  fs.writeFileSync(filePath, result, 'utf8')
  return converted
}

// ── items/rows string → object normalization ──────────────────────

function normalizeFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  const out = lines.map(line => {
    const trimmed = line.trimStart()
    if (!trimmed.startsWith('{"tag":')) return line
    const trailingComma = trimmed.endsWith(',')
    const json = trailingComma ? trimmed.slice(0, -1) : trimmed
    try {
      const block = JSON.parse(json)
      if (block.tag === 'ul' && block.items)
        block.items = block.items.map(v => typeof v === 'string' ? { text: v } : v)
      if (block.tag === 'table') {
        if (block.headers) block.headers = block.headers.map(v => typeof v === 'string' ? { text: v } : v)
        if (block.rows) block.rows = block.rows.map(row => row.map(v => typeof v === 'string' ? { text: v } : v))
      }
      const indent = line.slice(0, line.length - trimmed.length)
      return indent + JSON.stringify(block) + (trailingComma ? ',' : '')
    } catch { return line }
  })
  fs.writeFileSync(filePath, out.join('\n'), 'utf8')
}

// ── Write per-chapter files ───────────────────────────────────────

fs.mkdirSync(outDir, { recursive: true });

for (let i = 0; i < chapters.length; i++) {
  const ch = chapters[i];
  const chPages = pagesByChapter[i] || [];
  const filename = `ch_${String(i).padStart(2, '0')}.js`;
  const outPath = path.join(outDir, filename);

  const entries = chPages.map(p => {
    const htmlEscaped = p.html.replace(/`/g, '\\`').replace(/\${/g, '\\${');
    return `  {
    page: ${p.page},
    type: "普通",
    html: \`${htmlEscaped}\`,
  }`;
  }).join(',\n');

  const fileContent = `// ${ch.num} - ${ch.title}
// ================================================================
// 格式说明:
//   type    - 内容类型: 重点 | 难点 | 考点 | 定义 | 公式 | 案例 | 普通
//   color   - 可选自定义颜色 (如 "#ff6b6b")，不填则使用类型默认颜色
//   content - 结构化内容数组，格式:
//     { tag: "h2" | "h3", text: "标题", bg: "#fff0f0" }
//     { tag: "p", text: "正文", color: "#f00", bg: "#fff0f0", bold: true }
//     { tag: "p", parts: [{ text: "...", color: "#f00", bold: true }] }
//     { tag: "ul", items: [{ text: "...", color: "#f00", bg: "#fff0f0" }] }
//     { tag: "table", headers: [{ text: "..." }], rows: [[{ text: "..." }]] }
//     { tag: "img", src: "图片路径", alt: "描述" }
// ================================================================

export default [
${entries}
];
`;

  fs.writeFileSync(outPath, fileContent, 'utf8');
  convertFile(outPath);
  normalizeFile(outPath);
  process.stdout.write(`  ✓ ${filename}  (${chPages.length} pages)\n`);
}

// ── Write meta.js ─────────────────────────────────────────────────

const metaContent = `// 章节元数据 — 手动可编辑
// title: 章节显示名称
// num: 章节编号标识

export const chapters = ${JSON.stringify(chapters, null, 2)};
`;
fs.writeFileSync(path.join(bookDir, 'meta.js'), metaContent, 'utf8');
console.log('\n✓ meta.js written');

// ── Write index.js ────────────────────────────────────────────────

const imports = chapters.map((_, i) => {
  const name = `ch${String(i).padStart(2, '0')}`;
  return `import ${name} from './chapters/ch_${String(i).padStart(2, '0')}.js';`;
}).join('\n');

const chExports = chapters.map((_, i) => `  ch${String(i).padStart(2, '0')}`).join(',\n');

const indexContent = `// 数据入口 — 自动生成，无需手动编辑
// 各章节数据请在 chapters/ch_XX.js 中编辑

${imports}

export const allChapterPages = [
${chExports}
];
`;
fs.writeFileSync(path.join(bookDir, 'index.js'), indexContent, 'utf8');
console.log('✓ index.js written');

// ── Write info.js (only if new or args provided) ──────────────────

const infoPath = path.join(bookDir, 'info.js');
if (!fs.existsSync(infoPath) || title) {
  const infoContent = `export default {
  id: '${bookId}',
  title: '${title || bookId}',
  subtitle: '${subtitle || ''}',
}
`;
  fs.writeFileSync(infoPath, infoContent, 'utf8');
  console.log('✓ info.js written');
}

// ── Regenerate books.js from all books with info.js ───────────────

const booksBaseDir = path.join(__dirname, 'app/src/data/books');
const bookIds = fs.readdirSync(booksBaseDir)
  .filter(d => {
    const p = path.join(booksBaseDir, d);
    return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'info.js'));
  })
  .sort();

const booksImports = bookIds.map((id, i) => [
  `import book${i}Info from './books/${id}/info.js'`,
  `import { chapters as book${i}Chapters } from './books/${id}/meta.js'`,
  `import { allChapterPages as book${i}Pages } from './books/${id}/index.js'`,
].join('\n')).join('\n');

const booksExport = bookIds.map((_, i) =>
  `  { ...book${i}Info, chapters: book${i}Chapters, allChapterPages: book${i}Pages }`
).join(',\n');

const booksJsContent = `${booksImports}

export const books = [
${booksExport}
]
`;
fs.writeFileSync(path.join(__dirname, 'app/src/data/books.js'), booksJsContent, 'utf8');
console.log('✓ books.js updated');

console.log(`\n完成! 共 ${chapters.length} 章, ${pages.length} 页`);

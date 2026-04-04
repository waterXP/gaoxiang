#!/usr/bin/env node
// convert_to_content.mjs — Convert html strings to structured content arrays
// Run: node convert_to_content.mjs
//
// Reads all ch_XX.js files in app/src/data/books/book-001/chapters/
// and replaces  html: `...`  with  content: [...]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const chaptersDir = path.join(__dirname, 'app/src/data/books/book-001/chapters')

// ── HTML entity decode ────────────────────────────────────────────
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// ── Parse inline content (with <strong>) into text or parts array ─
function parseInline(raw) {
  const text = decodeEntities(raw.trim())
  if (!text.includes('<strong>')) {
    return { text }
  }
  const parts = []
  const re = /(<strong>)([\s\S]*?)(<\/strong>)/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ text: m[2], bold: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  if (parts.length === 1 && parts[0].bold) return { text: parts[0].text, bold: true }
  return { parts }
}

// ── Strip all tags from a string ──────────────────────────────────
function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, ''))
}

// ── Parse <ul>...</ul> block ──────────────────────────────────────
function parseUl(inner) {
  const items = []
  const liRe = /<li>([\s\S]*?)<\/li>/g
  let m
  while ((m = liRe.exec(inner)) !== null) {
    const parsed = parseInline(m[1])
    if (parsed.parts) {
      items.push(parsed)
    } else if (parsed.bold) {
      items.push({ text: parsed.text, bold: true })
    } else {
      items.push(parsed.text)
    }
  }
  return { tag: 'ul', items }
}

// ── Parse <table>...</table> block ───────────────────────────────
function parseTable(inner) {
  const headers = []
  const rows = []
  const theadM = inner.match(/<thead>([\s\S]*?)<\/thead>/)
  const tbodyM = inner.match(/<tbody>([\s\S]*?)<\/tbody>/)

  if (theadM) {
    const thRe = /<th>([\s\S]*?)<\/th>/g
    let m
    while ((m = thRe.exec(theadM[1])) !== null) {
      const parsed = parseInline(m[1])
      headers.push(parsed.parts ? parsed : (parsed.bold ? { text: parsed.text, bold: true } : parsed.text))
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
        const parsed = parseInline(tdM[1])
        row.push(parsed.parts ? parsed : (parsed.bold ? { text: parsed.text, bold: true } : parsed.text))
      }
      if (row.length) rows.push(row)
    }
  }

  const block = { tag: 'table', rows }
  if (headers.length) block.headers = headers
  return block
}

// ── Main HTML → content parser ───────────────────────────────────
function parseHtml(html) {
  const content = []
  // Tokenise by top-level tags
  const re = /<(h2|h3|p|ul|table)(\s[^>]*)?>[\s\S]*?<\/\1>/g
  let m
  while ((m = re.exec(html)) !== null) {
    const tag = m[1]
    const full = m[0]

    if (tag === 'h2' || tag === 'h3') {
      const inner = full.replace(/<\/?(?:h2|h3)[^>]*>/g, '')
      content.push({ tag, text: stripTags(inner) })
    } else if (tag === 'p') {
      const inner = full.replace(/<\/?p[^>]*>/g, '')
      const parsed = parseInline(inner)
      const block = { tag: 'p' }
      if (parsed.parts) {
        block.parts = parsed.parts
      } else {
        block.text = parsed.text
        if (parsed.bold) block.bold = true
      }
      content.push(block)
    } else if (tag === 'ul') {
      const inner = full.replace(/^<ul[^>]*>|<\/ul>$/g, '')
      content.push(parseUl(inner))
    } else if (tag === 'table') {
      const inner = full.replace(/^<table[^>]*>|<\/table>$/g, '')
      content.push(parseTable(inner))
    }
  }
  return content
}

// ── Serialize a content array to JS source ───────────────────────
function serializeContent(content) {
  const lines = []
  lines.push('content: [')
  for (const block of content) {
    lines.push('    ' + JSON.stringify(block) + ',')
  }
  lines.push('  ]')
  return lines.join('\n  ')
}

// ── Process one file ─────────────────────────────────────────────
function processFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8')

  // Match each entry's html template literal: html: `...`,
  // We need to handle multiline template literals carefully.
  // Strategy: find all  html: `...`  occurrences using a state machine.

  let result = ''
  let i = 0
  let converted = 0

  while (i < src.length) {
    // Look for `html: \`` pattern
    const marker = 'html: `'
    const idx = src.indexOf(marker, i)
    if (idx === -1) {
      result += src.slice(i)
      break
    }

    // Check if this occurrence is inside a // comment line
    const lineStart = src.lastIndexOf('\n', idx) + 1
    const linePrefix = src.slice(lineStart, idx)
    if (linePrefix.trimStart().startsWith('//')) {
      // Skip — copy up to and including this marker, continue
      result += src.slice(i, idx + marker.length)
      i = idx + marker.length
      continue
    }

    result += src.slice(i, idx)
    i = idx + marker.length

    // Collect template literal content until unescaped `
    let htmlContent = ''
    while (i < src.length) {
      if (src[i] === '\\' && i + 1 < src.length) {
        // Escaped char — keep as-is in the html string representation,
        // but decode for parsing
        htmlContent += src[i + 1] === '`' ? '`' : src[i] + src[i + 1]
        i += 2
      } else if (src[i] === '`') {
        i++ // consume closing backtick
        break
      } else {
        htmlContent += src[i++]
      }
    }

    // Parse the html content
    const contentArr = parseHtml(htmlContent)

    if (contentArr.length === 0) {
      // Nothing parseable — keep original html
      const escaped = htmlContent.replace(/`/g, '\\`').replace(/\${/g, '\\${')
      result += `html: \`${escaped}\``
    } else {
      result += serializeContent(contentArr)
      converted++
    }
  }

  fs.writeFileSync(filePath, result, 'utf8')
  return converted
}

// ── Run on all chapter files ─────────────────────────────────────
const files = fs.readdirSync(chaptersDir)
  .filter(f => f.endsWith('.js'))
  .sort()

let total = 0
for (const f of files) {
  const fp = path.join(chaptersDir, f)
  const n = processFile(fp)
  total += n
  console.log(`  ✓ ${f}  (${n} entries converted)`)
}
console.log(`\n完成! 共转换 ${total} 个条目`)

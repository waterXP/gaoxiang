/**
 * 将 DSL 里的 "headers:..." / "row:..." 字符串合并为表格对象
 * 运行: node convert_table_to_obj.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHAPTERS_DIR = path.join(__dirname, 'app/src/data/books/book-001/chapters')

function isHeaders(s) { return typeof s === 'string' && s.startsWith('headers:') }
function isRow(s)     { return typeof s === 'string' && s.startsWith('row:') }

function splitCells(str) {
  return str.split('::').map(s => s.trim())
}

function groupTables(content) {
  const result = []
  let i = 0
  while (i < content.length) {
    const item = content[i]
    if (isHeaders(item) || isRow(item)) {
      const tbl = {}
      while (i < content.length && (isHeaders(content[i]) || isRow(content[i]))) {
        const cur = content[i]
        if (isHeaders(cur)) {
          if (tbl.headers) break  // 第二个 headers 另起新表
          tbl.headers = splitCells(cur.slice('headers:'.length))
        } else {
          if (!tbl.rows) tbl.rows = []
          tbl.rows.push(splitCells(cur.slice('row:'.length)))
        }
        i++
      }
      result.push(tbl)
    } else if (Array.isArray(item)) {
      result.push(item)  // 数组保持原样
      i++
    } else {
      result.push(item)
      i++
    }
  }
  return result
}

function serializeCell(cell) {
  return JSON.stringify(cell)
}

function serializeItem(item, indent) {
  if (Array.isArray(item)) {
    if (item.length === 0) return `${indent}[],`
    const inner = item.map(el => serializeItem(el, indent + '  ')).join('\n')
    return `${indent}[\n${inner}\n${indent}],`
  }
  if (typeof item === 'object' && item !== null && (item.headers || item.rows)) {
    const lines = [`${indent}{`]
    if (item.headers) {
      lines.push(`${indent}  headers: [${item.headers.map(serializeCell).join(', ')}],`)
    }
    if (item.rows) {
      lines.push(`${indent}  rows: [`)
      for (const row of item.rows) {
        lines.push(`${indent}    [${row.map(serializeCell).join(', ')}],`)
      }
      lines.push(`${indent}  ],`)
    }
    lines.push(`${indent}},`)
    return lines.join('\n')
  }
  return `${indent}${JSON.stringify(item)},`
}

function serializeContent(content) {
  const lines = content.map(item => serializeItem(item, '      '))
  return `[\n${lines.join('\n')}\n    ]`
}

async function main() {
  const files = fs.readdirSync(CHAPTERS_DIR).filter(f => f.endsWith('.js')).sort()
  let totalTables = 0

  for (const file of files) {
    const filePath = path.join(CHAPTERS_DIR, file)
    const { default: pages } = await import(filePath)

    const newPages = pages.map(page => ({
      ...page,
      content: groupTables(page.content),
    }))

    for (const page of newPages)
      for (const item of page.content)
        if (typeof item === 'object' && !Array.isArray(item) && (item.headers || item.rows)) totalTables++

    const header = `// ${file.replace('.js', '')} - 已转换为 DSL 字符串格式\n\nexport default [\n`
    const footer = `];\n`
    const body = newPages.map(page =>
      `  {\n    page: ${page.page},\n    type: ${JSON.stringify(page.type)},\n    content: ${serializeContent(page.content)},\n  },`
    ).join('\n')

    fs.writeFileSync(filePath, header + body + '\n' + footer)
    console.log(`✓ ${file}`)
  }

  console.log(`\n完成：生成 ${totalTables} 个表格对象`)
}

main().catch(console.error)

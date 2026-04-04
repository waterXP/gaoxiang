#!/usr/bin/env node
// normalize_content.mjs — Convert string items/cells to { text } objects
// Run: node normalize_content.mjs

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const chaptersDir = path.join(__dirname, 'app/src/data/books/book-001/chapters')

function toObj(v) {
  return typeof v === 'string' ? { text: v } : v
}

function transformBlock(block) {
  if (block.tag === 'ul' && block.items) {
    block.items = block.items.map(toObj)
  }
  if (block.tag === 'table') {
    if (block.headers) block.headers = block.headers.map(toObj)
    if (block.rows) block.rows = block.rows.map(row => row.map(toObj))
  }
  return block
}

function processFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  let changed = 0

  const out = lines.map(line => {
    const trimmed = line.trimStart()
    if (!trimmed.startsWith('{"tag":')) return line
    const trailingComma = trimmed.endsWith(',')
    const json = trailingComma ? trimmed.slice(0, -1) : trimmed
    try {
      const block = JSON.parse(json)
      const transformed = transformBlock(block)
      const indent = line.slice(0, line.length - trimmed.length)
      changed++
      return indent + JSON.stringify(transformed) + (trailingComma ? ',' : '')
    } catch {
      return line
    }
  })

  fs.writeFileSync(filePath, out.join('\n'), 'utf8')
  return changed
}

const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.js')).sort()
let total = 0
for (const f of files) {
  const n = processFile(path.join(chaptersDir, f))
  total += n
  console.log(`  ✓ ${f}  (${n} blocks)`)
}
console.log(`\n完成! 共处理 ${total} 个 block`)

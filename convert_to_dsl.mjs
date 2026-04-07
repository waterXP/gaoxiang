/**
 * 将 book-001 章节数据从对象格式转换为字符串 DSL 格式
 * 运行: node convert_to_dsl.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHAPTERS_DIR = path.join(__dirname, 'app/src/data/books/book-001/chapters')

// 将 text（字符串或数组）转为单个字符串（数组用 \n 合并）
function textToStr(text) {
  if (Array.isArray(text)) return text.join('\n')
  return text ?? ''
}

// 从对象属性提取 DSL 修饰符列表
function modifiers(obj) {
  const mods = []
  if (obj.align === 'center') mods.push('center')
  else if (obj.align === 'left') mods.push('left')
  else if (obj.align === 'right') mods.push('right')
  if (obj.bold) mods.push('bold')
  if (obj.highlight) mods.push('hi')
  if (obj.important) mods.push('im')
  // 红色 color 近似为 im
  if (!obj.important && obj.color && /^#?[eE][0-9a-fA-F]{5}$|^#[fF][0-9a-fA-F]{5}$|^#[fF][0]0$|^red$/i.test(obj.color)) {
    if (!mods.includes('im')) mods.push('im')
  }
  return mods
}

// 判断对象是否有无法用 DSL 表达的属性（需保留为对象）
function needsObject(obj) {
  if (obj.parts) return true  // 行内混合样式
  if (obj.color && !isRedish(obj.color)) return true  // 非红色自定义颜色
  if (obj.bg && !obj.highlight) return true  // 自定义背景色
  return false
}

function isRedish(color) {
  if (!color) return false
  const c = color.toLowerCase()
  return c === 'red' || c === '#f00' || c === '#ff0000' || c === '#e53935' || c.startsWith('#f') || c.startsWith('#e')
}

// 将单个 block 对象转换为 DSL 字符串（或保留对象）
function convertBlock(block) {
  const { tag } = block

  if (tag === 'img') {
    return `img:${block.src}`
  }

  if (tag === 'ul') {
    return [block.items.map(item => {
      if (typeof item === 'string') return item
      if (needsObject(item)) return item  // fallback: 保留对象
      const mods = modifiers(item)
      const prefix = mods.length ? `txt/${mods.join('/')}` : ''
      const text = textToStr(item.text)
      return prefix ? `${prefix}:${text}` : text
    })]
  }

  if (tag === 'table') {
    const lines = []
    if (block.headers) {
      lines.push(`headers:${block.headers.map(h => (typeof h === 'string' ? h : textToStr(h.text))).join('::')}`)
    }
    for (const row of block.rows) {
      lines.push(`row:${row.map(cell => (typeof cell === 'string' ? cell : textToStr(cell.text))).join('::')}`)
    }
    return lines
  }

  // h2/h3/p
  if (needsObject(block)) return block  // fallback: 保留对象

  const mods = modifiers(block)
  const rawTag = tag === 'p' ? '' : tag  // p 可省略前缀
  const prefix = rawTag
    ? (mods.length ? `${rawTag}/${mods.join('/')}` : rawTag)
    : (mods.length ? `txt/${mods.join('/')}` : '')  // 纯 p 无修饰符时省略前缀

  const text = textToStr(block.text)
  return prefix ? `${prefix}:${text}` : text
}

// 将整个 content 数组转换
function convertContent(content) {
  const result = []
  for (const block of content) {
    if (typeof block === 'string') {
      result.push(block)  // 已经是字符串，保留
      continue
    }
    const out = convertBlock(block)
    if (Array.isArray(out)) result.push(...out)
    else result.push(out)
  }
  return result
}

// 序列化单个 content 条目
function serializeItem(item, indent = '      ') {
  if (Array.isArray(item)) {
    const inner = item.map(el => `${indent}  ${JSON.stringify(el)},`).join('\n')
    return `${indent}[\n${inner}\n${indent}],`
  }
  return `${indent}${JSON.stringify(item)},`
}

// 序列化 content 数组为 JS 源码
function serializeContent(content) {
  const lines = content.map(item => serializeItem(item))
  return `[\n${lines.join('\n')}\n    ]`
}

// 处理单个章节文件
function convertFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8')

  // 动态 import 读取数据
  return src
}

async function main() {
  const files = fs.readdirSync(CHAPTERS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort()

  let totalConverted = 0
  let totalFallback = 0

  for (const file of files) {
    const filePath = path.join(CHAPTERS_DIR, file)
    const { default: pages } = await import(filePath)

    const newPages = pages.map(page => ({
      ...page,
      content: convertContent(page.content),
    }))

    // 统计
    for (const page of newPages) {
      for (const item of page.content) {
        if (typeof item === 'string') totalConverted++
        else totalFallback++
      }
    }

    // 生成新文件内容
    const header = `// ${file.replace('.js', '')} - 已转换为 DSL 字符串格式\n\nexport default [\n`
    const footer = `];\n`

    const body = newPages.map(page => {
      const contentStr = serializeContent(page.content)
      const typeStr = JSON.stringify(page.type)
      return `  {\n    page: ${page.page},\n    type: ${typeStr},\n    content: ${contentStr},\n  },`
    }).join('\n')

    fs.writeFileSync(filePath, header + body + '\n' + footer)
    console.log(`✓ ${file} (${newPages.length} pages)`)
  }

  console.log(`\n完成：${totalConverted} 条已转 DSL，${totalFallback} 条保留对象（需手动处理）`)
}

main().catch(console.error)

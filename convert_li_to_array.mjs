/**
 * 将已有 DSL 文件里的 "li:..." 字符串合并为数组格式
 * 运行: node convert_li_to_array.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHAPTERS_DIR = path.join(__dirname, 'app/src/data/books/book-001/chapters')

// 将 content 数组里连续的 li: 字符串合并为数组
function groupLis(content) {
  const result = []
  let i = 0
  while (i < content.length) {
    const item = content[i]
    if (typeof item === 'string' && (item.startsWith('li:') || item.startsWith('li/'))) {
      const group = []
      while (i < content.length) {
        const cur = content[i]
        if (typeof cur === 'string' && (cur.startsWith('li:') || cur.startsWith('li/'))) {
          // 去掉 li 前缀，保留修饰符（li/hi:文字 → txt/hi:文字，li:文字 → 文字）
          const colon = cur.indexOf(':')
          const head = cur.slice(0, colon)   // e.g. "li" or "li/hi/bold"
          const text = cur.slice(colon + 1)
          const mods = head.split('/').slice(1)  // 去掉第一个 "li"
          const entry = mods.length ? `txt/${mods.join('/')}:${text}` : text
          group.push(entry)
          i++
        } else if (Array.isArray(cur)) {
          // 已经是数组的也合并进来（递归处理嵌套）
          group.push(groupLis(cur))
          i++
        } else {
          break
        }
      }
      result.push(group)
    } else if (Array.isArray(item)) {
      result.push(groupLis(item))  // 递归处理已有数组
      i++
    } else {
      result.push(item)
      i++
    }
  }
  return result
}

// 序列化单个 content 条目
function serializeItem(item, indent) {
  if (Array.isArray(item)) {
    if (item.length === 0) return `${indent}[],`
    const inner = item.map(el => serializeItem(el, indent + '  ')).join('\n')
    return `${indent}[\n${inner}\n${indent}],`
  }
  return `${indent}${JSON.stringify(item)},`
}

function serializeContent(content) {
  const lines = content.map(item => serializeItem(item, '      '))
  return `[\n${lines.join('\n')}\n    ]`
}

async function main() {
  const files = fs.readdirSync(CHAPTERS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort()

  let totalArrays = 0

  for (const file of files) {
    const filePath = path.join(CHAPTERS_DIR, file)
    const { default: pages } = await import(filePath)

    const newPages = pages.map(page => ({
      ...page,
      content: groupLis(page.content),
    }))

    // 统计生成了多少个数组
    for (const page of newPages) {
      for (const item of page.content) {
        if (Array.isArray(item)) totalArrays++
      }
    }

    const header = `// ${file.replace('.js', '')} - 已转换为 DSL 字符串格式\n\nexport default [\n`
    const footer = `];\n`
    const body = newPages.map(page => {
      const contentStr = serializeContent(page.content)
      return `  {\n    page: ${page.page},\n    type: ${JSON.stringify(page.type)},\n    content: ${contentStr},\n  },`
    }).join('\n')

    fs.writeFileSync(filePath, header + body + '\n' + footer)
    console.log(`✓ ${file}`)
  }

  console.log(`\n完成：生成 ${totalArrays} 个 ul 数组`)
}

main().catch(console.error)

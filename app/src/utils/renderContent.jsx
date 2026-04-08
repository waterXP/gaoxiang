/**
 * 内容渲染器
 *
 * 字符串 DSL 格式:
 *   "txt:内容"            段落（txt: 可省略）
 *   "h1:内容" ~ "h6:内容"  标题
 *   "img:图片路径"         图片
 *   "headers:A::B::C"    表头（与紧跟的 row 合并为 <table>）
 *   "row:A::B::C"        表格行（列用 :: 分隔）
 *   [...items]           数组 → <ul>，可嵌套
 *
 * 修饰符（放在 : 前，用 / 分隔）:
 *   im              → 红色字体 #e53935（非常重要）
 *   hi              → 黄色背景 #fff176（重要）
 *   bold            → 加粗
 *   left/center/right → 对齐方式
 *
 * 示例:
 *   "txt/im:非常重要的内容"
 *   "h2/center:居中标题"
 *   "headers:姓名::年龄" / "row:张三::18"
 *   ["列表项1", "txt/hi:高亮项", ["嵌套子项A", "嵌套子项B"]]
 *
 * 旧版对象格式（向后兼容）
 */

// ---------- 通用工具 ----------

function renderText(text) {
  if (!text) return text
  const lines = Array.isArray(text)
    ? text.flatMap(s => s.split('\n'))
    : text.split('\n')
  if (lines.length === 1) return lines[0]
  return lines.flatMap((line, i, arr) =>
    i < arr.length - 1 ? [line, <br key={i} />] : [line]
  )
}

// ---------- DSL 解析 ----------

const TAGS = new Set(['txt', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'headers', 'row'])
const CELL_SPAN = /^(cols|rows)-(\d+)$/
const CELL_MODS = new Set(['im', 'hi', 'bold', 'left', 'center', 'right'])

// 解析表格单元格字符串
// "cols-2/hi:内容" → { text, colspan: 2, style: {background} }
function parseCell(str) {
  if (typeof str !== 'string') return { text: str }
  const colon = str.indexOf(':')
  if (colon === -1) return { text: str }
  const head = str.slice(0, colon)
  const parts = head.split('/')
  if (!parts.some(p => CELL_SPAN.test(p) || CELL_MODS.has(p))) return { text: str }
  const content = str.slice(colon + 1)
  let colspan, rowspan
  const style = {}
  for (const p of parts) {
    const m = p.match(CELL_SPAN)
    if (m) { if (m[1] === 'cols') colspan = +m[2]; else rowspan = +m[2] }
    else if (p === 'im' && !style.color) style.color = '#e53935'
    else if (p === 'hi' && !style.background) style.background = '#fff176'
    else if (p === 'bold') style.fontWeight = 'bold'
    else if (p === 'left' || p === 'center' || p === 'right') style.textAlign = p
  }
  return { text: content, colspan, rowspan, style: Object.keys(style).length ? style : undefined }
}

// 渲染新格式表格对象 { headers?, rows? }
function renderTableObj(tbl, key) {
  return (
    <table key={key}>
      {tbl.headers && (
        <thead>
          <tr>
            {tbl.headers.map((h, j) => {
              const c = parseCell(h)
              return <th key={j} colSpan={c.colspan} rowSpan={c.rowspan} style={c.style}>{renderText(c.text)}</th>
            })}
          </tr>
        </thead>
      )}
      {tbl.rows && (
        <tbody>
          {tbl.rows.map((row, j) => (
            <tr key={j}>
              {row.map((cell, k) => {
                if (Array.isArray(cell)) return <td key={k}>{renderUl(cell)}</td>
                const c = parseCell(cell)
                return <td key={k} colSpan={c.colspan} rowSpan={c.rowspan} style={c.style}>{renderText(c.text)}</td>
              })}
            </tr>
          ))}
        </tbody>
      )}
    </table>
  )
}

function parseStr(str) {
  const colon = str.indexOf(':')
  const head = colon === -1 ? str : str.slice(0, colon)
  const baseTag = head.split('/')[0]

  if (!TAGS.has(baseTag)) {
    return { tag: 'p', content: str, style: undefined, cells: undefined }
  }

  const content = colon === -1 ? '' : str.slice(colon + 1)
  const parts = head.split('/')
  const tag = parts[0] === 'txt' ? 'p' : parts[0]

  const style = {}
  for (let i = 1; i < parts.length; i++) {
    const m = parts[i]
    if (m === 'im') { if (!style.color) style.color = '#e53935' }
    else if (m === 'hi') { if (!style.background) style.background = '#fff176' }
    else if (m === 'bold') style.fontWeight = 'bold'
    else if (m === 'left' || m === 'center' || m === 'right') style.textAlign = m
  }

  return {
    tag,
    content,
    style: Object.keys(style).length ? style : undefined,
    cells: (tag === 'headers' || tag === 'row') ? content.split('::').map(s => s.trim()) : undefined,
  }
}

// 渲染数组为 <ul>，支持嵌套
function renderUl(items, key) {
  return (
    <ul key={key}>
      {items.map((item, j) => {
        if (Array.isArray(item)) {
          return <li key={j}>{renderUl(item)}</li>
        }
        if (typeof item === 'string') {
          const node = parseStr(item)
          return <li key={j} style={node.style}>{renderText(node.content)}</li>
        }
        // 旧版对象
        const s = buildStyle(item)
        return <li key={j} style={s}>{renderText(item.text)}</li>
      })}
    </ul>
  )
}

// 将 content 数组分组：连续 headers/row → table
function group(items) {
  const result = []
  let i = 0
  while (i < items.length) {
    const item = items[i]
    if (Array.isArray(item)) {
      result.push({ kind: 'ul', items: item })
      i++
      continue
    }
    if (typeof item === 'object' && item !== null && (item.headers || item.rows)) {
      result.push({ kind: 'table-obj', tbl: item })
      i++
      continue
    }
    if (typeof item !== 'string') {
      result.push({ kind: 'obj', item })
      i++
      continue
    }
    const node = parseStr(item)
    if (node.tag === 'headers' || node.tag === 'row') {
      const tbl = { headers: null, rows: [] }
      while (i < items.length && typeof items[i] === 'string') {
        const n = parseStr(items[i])
        if (n.tag === 'headers') {
          if (tbl.headers !== null) break
          tbl.headers = n.cells
          i++
        } else if (n.tag === 'row') {
          tbl.rows.push(n.cells)
          i++
        } else break
      }
      result.push({ kind: 'table', tbl })
    } else {
      result.push({ kind: 'node', node })
      i++
    }
  }
  return result
}

// ---------- 旧版对象格式渲染（向后兼容） ----------

function buildStyle(o) {
  const style = {}
  if (o.color) style.color = o.color
  else if (o.important) style.color = '#e53935'
  if (o.bold) style.fontWeight = 'bold'
  if (o.bg) style.background = o.bg
  else if (o.highlight) style.background = '#fff176'
  if (o.align) style.textAlign = o.align
  return Object.keys(style).length ? style : undefined
}

function renderParts(parts) {
  return parts.map((part, i) => {
    if (typeof part === 'string') return part
    const style = buildStyle(part)
    return <span key={i} style={style}>{part.text}</span>
  })
}

function renderCell(cell) {
  if (typeof cell === 'string') return cell
  const style = buildStyle(cell)
  return style ? <span style={style}>{renderText(cell.text)}</span> : renderText(cell.text)
}

function renderObj(obj, i) {
  const style = buildStyle(obj)
  switch (obj.tag) {
    case 'h1': return <h1 key={i} style={style}>{renderText(obj.text)}</h1>
    case 'h2': return <h2 key={i} style={style}>{renderText(obj.text)}</h2>
    case 'h3': return <h3 key={i} style={style}>{renderText(obj.text)}</h3>
    case 'h4': return <h4 key={i} style={style}>{renderText(obj.text)}</h4>
    case 'h5': return <h5 key={i} style={style}>{renderText(obj.text)}</h5>
    case 'h6': return <h6 key={i} style={style}>{renderText(obj.text)}</h6>
    case 'p':
      if (obj.parts) return <p key={i} style={style}>{renderParts(obj.parts)}</p>
      return <p key={i} style={style}>{renderText(obj.text)}</p>
    case 'ul':
      return renderUl(obj.items, i)
    case 'table':
      return (
        <table key={i} style={obj.bg ? { background: obj.bg } : undefined}>
          {obj.headers && (
            <thead>
              <tr>{obj.headers.map((h, j) => <th key={j}>{renderCell(h)}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {obj.rows.map((row, j) => (
              <tr key={j}>
                {row.map((cell, k) => <td key={k}>{renderCell(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'img':
      return <img key={i} src={obj.src} alt={obj.alt || ''} style={{ maxWidth: '100%', borderRadius: 4 }} />
    default:
      return null
  }
}

// ---------- 主渲染函数 ----------

export function renderContent(content) {
  return group(content).map((g, i) => {
    if (g.kind === 'ul') return renderUl(g.items, i)
    if (g.kind === 'table-obj') return renderTableObj(g.tbl, i)
    if (g.kind === 'obj') return renderObj(g.item, i)
    if (g.kind === 'node') {
      const { tag, content: text, style } = g.node
      if (/^h[1-6]$/.test(tag)) {
        const H = tag
        return <H key={i} style={style}>{renderText(text)}</H>
      }
      if (tag === 'p') return <p key={i} style={style}>{renderText(text)}</p>
      if (tag === 'img') return <img key={i} src={text} alt="" style={{ maxWidth: '100%', borderRadius: 4 }} />
      return null
    }
    if (g.kind === 'table') {
      const { tbl } = g
      return (
        <table key={i}>
          {tbl.headers && (
            <thead>
              <tr>{tbl.headers.map((h, j) => <th key={j}>{renderText(h)}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {tbl.rows.map((row, j) => (
              <tr key={j}>
                {row.map((cell, k) => <td key={k}>{renderText(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    return null
  })
}

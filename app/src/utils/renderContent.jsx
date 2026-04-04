/**
 * 内容对象格式渲染器
 *
 * 支持格式:
 *   { tag: "h2" | "h3" | "p", text: "...", color: "#f00", bg: "#fff0f0", bold: true }
 *   { tag: "p", parts: [{ text: "...", color: "#f00", bold: true }, ...] }
 *   { tag: "ul", items: ["..." | { text: "...", color: "#f00", bg: "#fff0f0", bold: true }], bg: "..." }
 *   { tag: "table", headers: ["..." | { text, color, bg }], rows: [[...]], bg: "..." }
 *   { tag: "img", src: "图片路径", alt: "描述" }
 */

function renderParts(parts) {
  return parts.map((part, i) => {
    if (typeof part === 'string') return part
    const style = {}
    if (part.color) style.color = part.color
    if (part.bold) style.fontWeight = 'bold'
    if (part.bg) style.background = part.bg
    if (Object.keys(style).length === 0) return <span key={i}>{part.text}</span>
    return <span key={i} style={style}>{part.text}</span>
  })
}

function renderCell(cell) {
  if (typeof cell === 'string') return cell
  const style = {}
  if (cell.color) style.color = cell.color
  if (cell.bold) style.fontWeight = 'bold'
  if (cell.bg) style.background = cell.bg
  if (Object.keys(style).length === 0) return cell.text
  return <span style={style}>{cell.text}</span>
}

export function renderContent(content) {
  return content.map((block, i) => {
    const style = {}
    if (block.color) style.color = block.color
    if (block.bold) style.fontWeight = 'bold'
    if (block.bg) style.background = block.bg

    switch (block.tag) {
      case 'h2':
        return <h2 key={i} style={style}>{block.text}</h2>
      case 'h3':
        return <h3 key={i} style={style}>{block.text}</h3>
      case 'p':
        if (block.parts) {
          return <p key={i} style={style}>{renderParts(block.parts)}</p>
        }
        return <p key={i} style={style}>{block.text}</p>
      case 'ul':
        return (
          <ul key={i} style={block.bg ? { background: block.bg } : undefined}>
            {block.items.map((item, j) => {
              if (typeof item === 'string') return <li key={j}>{item}</li>
              const s = {}
              if (item.color) s.color = item.color
              if (item.bold) s.fontWeight = 'bold'
              if (item.bg) s.background = item.bg
              return <li key={j} style={Object.keys(s).length ? s : undefined}>{item.text}</li>
            })}
          </ul>
        )
      case 'table':
        return (
          <table key={i} style={block.bg ? { background: block.bg } : undefined}>
            {block.headers && (
              <thead>
                <tr>{block.headers.map((h, j) => <th key={j}>{renderCell(h)}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, j) => (
                <tr key={j}>
                  {row.map((cell, k) => <td key={k}>{renderCell(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )
      case 'img':
        return <img key={i} src={block.src} alt={block.alt || ''} style={{ maxWidth: '100%', borderRadius: 4 }} />
      default:
        return null
    }
  })
}

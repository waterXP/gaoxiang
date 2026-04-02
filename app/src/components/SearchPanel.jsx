function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function SearchPanel({ results, query, chapters, onSelect }) {
  if (!query.trim()) return null

  return (
    <div className="search-panel">
      <h3>找到 {results.length} 条结果（"{query}"）</h3>
      {results.map((r, idx) => {
        const p = r.item
        const ch = chapters[p.chapterIdx]?.title ?? ''
        let snip = p.text?.substring(0, 200) ?? ''
        if (r.matches?.[0]) {
          const [s] = r.matches[0].indices[0]
          const from = Math.max(0, s - 60)
          snip = (from > 0 ? '…' : '') + (p.text?.substring(from, from + 240) ?? '')
        }
        const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const highlighted = esc(snip).replace(new RegExp(esc(safeQ), 'gi'), m => `<mark>${m}</mark>`)

        return (
          <div key={idx} className="sr-item" onClick={() => onSelect(p.chapterIdx, p.page)}>
            <div className="sr-tag">第 {p.page} 页 · {ch}</div>
            <div className="sr-snippet" dangerouslySetInnerHTML={{ __html: highlighted }} />
          </div>
        )
      })}
    </div>
  )
}

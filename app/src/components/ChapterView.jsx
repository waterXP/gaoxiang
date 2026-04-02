import { useEffect, useRef } from 'react'
import { getTypeStyle } from '../data/types.js'
import { CONTENT_TYPES } from '../data/types.js'

function PageBlock({ page, memoMode }) {
  const style = getTypeStyle(page.type, page.color)
  const isPlain = (!page.type || page.type === '普通') && !page.color
  const blockRef = useRef(null)

  // Attach memo click handlers when memo mode changes
  useEffect(() => {
    if (!blockRef.current) return
    const els = blockRef.current.querySelectorAll('p, li')
    if (memoMode) {
      els.forEach(el => {
        el.style.cursor = 'pointer'
        const handler = () => el.classList.toggle('show')
        el._memoHandler = handler
        el.addEventListener('click', handler)
      })
    } else {
      els.forEach(el => {
        el.classList.remove('show')
        if (el._memoHandler) {
          el.removeEventListener('click', el._memoHandler)
          delete el._memoHandler
        }
      })
    }
    return () => {
      els.forEach(el => {
        if (el._memoHandler) {
          el.removeEventListener('click', el._memoHandler)
          delete el._memoHandler
        }
      })
    }
  }, [memoMode, page.html])

  return (
    <div
      ref={blockRef}
      className={`page-block${isPlain ? ' type-普通' : ''}`}
      style={isPlain ? {} : {
        '--block-color': style.color,
        '--block-bg': style.bg,
      }}
      data-page={page.page}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="page-marker">第 {page.page} 页</span>
        {!isPlain && (
          <span
            className="type-badge"
            style={{ color: style.color }}
          >
            {style.icon} {style.label}
          </span>
        )}
      </div>
      <div dangerouslySetInnerHTML={{ __html: page.html }} />
    </div>
  )
}

export default function ChapterView({
  chapter, pages, curChIdx, totalChapters, done, onToggleDone,
  onPrev, onNext, memoMode, scrollToPage
}) {
  const articleRef = useRef(null)

  useEffect(() => {
    if (articleRef.current) articleRef.current.scrollTop = 0
  }, [curChIdx])

  useEffect(() => {
    if (!scrollToPage || !articleRef.current) return
    const el = articleRef.current.querySelector(`[data-page="${scrollToPage}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollToPage])

  if (!chapter) {
    return (
      <div className="chapter-panel">
        <div className="ch-header"><h2>请从左侧选择章节</h2></div>
        <div className="article" ref={articleRef} />
      </div>
    )
  }

  return (
    <div className="chapter-panel">
      <div className="ch-header">
        <h2>{chapter.title}</h2>
        <span className="ch-meta">第 {chapter.startPage} 页起 · {pages.length} 页</span>
        <button
          className={`done-btn${done ? ' done' : ''}`}
          onClick={onToggleDone}
        >
          {done ? '✅ 已学完' : '✓ 标记已学'}
        </button>
      </div>

      <div
        className="article"
        ref={articleRef}
      >
        {pages.map((p, i) => (
          <PageBlock key={`${p.page}-${i}`} page={p} memoMode={memoMode} />
        ))}
      </div>

      <div className="ch-nav">
        <button onClick={onPrev} disabled={curChIdx === 0}>← 上一章</button>
        <span className="nav-info">{curChIdx + 1} / {totalChapters} 章</span>
        <button onClick={onNext} disabled={curChIdx === totalChapters - 1}>下一章 →</button>
      </div>
    </div>
  )
}

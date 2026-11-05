import { Button, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined } from '@ant-design/icons'
import { useEffect, useRef } from 'react'
import { getTypeStyle } from '../data/types.js'
import { renderContent } from '../utils/renderContent.jsx'

function PageBlock({ page, memoMode, pointMap, onPointClick, renderImage }) {
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
  }, [memoMode, page.html, page.content])

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
          <Tag
            color={style.color}
            style={{ color: style.color, background: style.bg, borderColor: style.color }}
          >
            {style.icon} {style.label}
          </Tag>
        )}
      </div>
      <div dangerouslySetInnerHTML={page.html ? { __html: page.html } : undefined}>
        {page.content ? renderContent(page.content, { pointMap, onPointClick, renderImage }) : null}
      </div>
    </div>
  )
}

export default function ChapterView({
  chapter, pages, curChIdx, totalChapters, done, onToggleDone,
  onPrev, onNext, memoMode, scrollToPage, pointMap, onPointClick, standalonePoint, renderImage,
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
        <div className="ch-header"><Typography.Title level={4} style={{ margin: 0 }}>请从左侧选择章节</Typography.Title></div>
        <div className="article-shell" ref={articleRef}>
          <div className="article" />
        </div>
      </div>
    )
  }

  return (
    <div className="chapter-panel">
      <div className="ch-header">
        <Typography.Title level={4} style={{ margin: 0, flex: 1 }}>{chapter.title}</Typography.Title>
        <span className="ch-meta">第 {chapter.startPage} 页起 · {pages.length} 页</span>
        <Button
          type={done ? 'primary' : 'default'}
          icon={done ? <CheckOutlined /> : undefined}
          onClick={onToggleDone}
        >
          {done ? '已学完' : '标记已学'}
        </Button>
      </div>

      <div className="article-shell" ref={articleRef}>
        <div className="article">
          {standalonePoint ? (
            <div className="page-block type-普通" data-page="point">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="page-marker">知识点</span>
              </div>
              {renderContent(standalonePoint.content, { pointMap, onPointClick, renderImage })}
            </div>
          ) : pages.map((p, i) => (
            <PageBlock
              key={`${p.page}-${i}`}
              page={p}
              memoMode={memoMode}
              pointMap={pointMap}
              onPointClick={onPointClick}
              renderImage={renderImage}
            />
          ))}
        </div>
      </div>

      <div className="ch-nav">
        <Button icon={<ArrowLeftOutlined />} onClick={onPrev} disabled={curChIdx === 0}>上一章</Button>
        <span className="nav-info">{curChIdx + 1} / {totalChapters} 章</span>
        <Button icon={<ArrowRightOutlined />} iconPlacement="end" onClick={onNext} disabled={curChIdx === totalChapters - 1}>下一章</Button>
      </div>
    </div>
  )
}

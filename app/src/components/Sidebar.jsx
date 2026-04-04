import { useState } from 'react'

export default function Sidebar({
  books, curBookIdx, onSelectBook,
  chapters, curChIdx, done, streak, onSelect, onCheckin, isOpen, onClose
}) {
  const [bookListOpen, setBookListOpen] = useState(false)
  const today = new Date().toLocaleDateString('zh-CN')
  const checkedInToday = streak?.last === today
  const doneCount = Object.keys(done).length
  const total = chapters.length
  const curBook = books[curBookIdx]

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <div className={`sidebar${isOpen ? ' open' : ''}`}>
        <div className="sidebar-top">
          {/* Book selector */}
          <div className="book-selector">
            <div className="book-current">
              <div className="book-current-info">
                <div className="book-current-title">{curBook.title}</div>
                <div className="book-current-sub">{curBook.subtitle}</div>
              </div>
              {books.length > 1 && (
                <button
                  className={`book-switch-btn${bookListOpen ? ' open' : ''}`}
                  onClick={() => setBookListOpen(o => !o)}
                >
                  换书 ▾
                </button>
              )}
            </div>
            {bookListOpen && (
              <div className="book-list">
                {books.map((b, i) => (
                  <div
                    key={b.id}
                    className={`book-item${i === curBookIdx ? ' active' : ''}`}
                    onClick={() => { onSelectBook(i); setBookListOpen(false) }}
                  >
                    <div className="book-item-title">{b.title}</div>
                    <div className="book-item-sub">{b.subtitle}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="prog-row">
            <span>学习进度</span>
            <span>{doneCount} / {total} 章</span>
          </div>
          <div className="prog-bar">
            <div className="prog-fill" style={{ width: total ? `${doneCount / total * 100}%` : '0%' }} />
          </div>
          <button
            className={`checkin-btn${checkedInToday ? ' done' : ''}`}
            onClick={onCheckin}
          >
            {checkedInToday ? `✅ 已打卡（连续 ${streak.days} 天）` : '📅 今日打卡'}
          </button>
        </div>

        <div className="ch-list">
          {chapters.map((ch, i) => (
            <div
              key={i}
              className={`ch-item${i === curChIdx ? ' active' : ''}${done[i] ? ' done' : ''}`}
              onClick={() => onSelect(i)}
              ref={i === curChIdx ? el => el?.scrollIntoView({ block: 'nearest' }) : null}
            >
              <div className="ch-dot" />
              <div className="ch-label">{ch.title}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

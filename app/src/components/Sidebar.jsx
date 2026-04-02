import { CONTENT_TYPES } from '../data/types.js'

export default function Sidebar({
  chapters, curChIdx, done, streak, onSelect, onCheckin
}) {
  const today = new Date().toLocaleDateString('zh-CN')
  const checkedInToday = streak?.last === today
  const doneCount = Object.keys(done).length
  const total = chapters.length

  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <div className="app-title">信息系统项目管理师<br />2026 考试学习系统</div>
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
  )
}

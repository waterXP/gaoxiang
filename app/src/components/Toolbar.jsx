export default function Toolbar({
  searchQuery, onSearch, streak, memoMode, onToggleMemo, onRevealAll, onToggleSidebar
}) {
  const today = new Date().toLocaleDateString('zh-CN')
  const days = streak?.last === today ? streak.days : (streak?.days || 0)

  return (
    <div className="toolbar">
      <button className="tbtn sidebar-toggle" onClick={onToggleSidebar}>☰</button>
      <div className="search-wrap">
        <input
          className="search-input"
          type="text"
          placeholder="搜索知识点…"
          autoComplete="off"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onSearch('') }}
        />
        <span className="search-icon">🔍</span>
      </div>
      {days > 0 && <span className="streak">🔥 {days} 天</span>}
      <button
        className={`tbtn${memoMode ? ' on' : ''}`}
        onClick={onToggleMemo}
      >
        🙈 背诵
      </button>
      {memoMode && (
        <button className="tbtn" onClick={onRevealAll}>
          👁 显示
        </button>
      )}
    </div>
  )
}

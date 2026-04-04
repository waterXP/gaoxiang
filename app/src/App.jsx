import { useState, useCallback, useMemo } from 'react'
import Fuse from 'fuse.js'
import { books } from './data/books.js'
import { useStorage } from './hooks/useStorage.js'
import Sidebar from './components/Sidebar.jsx'
import Toolbar from './components/Toolbar.jsx'
import ChapterView from './components/ChapterView.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import './index.css'

// Extract text from html or content for search
function extractText(p) {
  if (p.text) return p.text
  if (p.html) return p.html.replace(/<[^>]+>/g, ' ')
  if (p.content) {
    return p.content.map(b => {
      if (b.text) return b.text
      if (b.parts) return b.parts.map(pt => typeof pt === 'string' ? pt : pt.text).join('')
      if (b.items) return b.items.map(it => typeof it === 'string' ? it : it.text).join(' ')
      if (b.rows) return b.rows.flat().map(c => typeof c === 'string' ? c : c.text).join(' ')
      return ''
    }).join(' ')
  }
  return ''
}

export default function App() {
  const { state, update } = useStorage()
  const [curBookIdx, setCurBookIdx] = useState(0)
  const [curChIdx, setCurChIdx] = useState(0)
  const [memoMode, setMemoMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [scrollToPage, setScrollToPage] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const curBook = books[curBookIdx]
  const { chapters, allChapterPages } = curBook

  // Per-book done state
  const booksDone = state.booksDone || {}
  const done = booksDone[curBook.id] || {}
  const streak = state.streak || { days: 0, last: null }

  // Pages for current chapter
  const curPages = useMemo(() => allChapterPages[curChIdx] || [], [allChapterPages, curChIdx])

  // Indexed pages for search — rebuilds when book changes
  const indexedPages = useMemo(() => {
    const allPages = allChapterPages.flatMap((chPages, chIdx) =>
      chPages.map(p => ({ ...p, chapterIdx: chIdx }))
    )
    return allPages.map(p => ({ ...p, text: extractText(p) }))
  }, [allChapterPages])

  // Search
  const handleSearch = useCallback((q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    const fuse = new Fuse(indexedPages, {
      keys: ['text'],
      threshold: 0.3,
      includeMatches: true,
      minMatchCharLength: 2,
      distance: 20000,
      ignoreLocation: true,
    })
    setSearchResults(fuse.search(q, { limit: 30 }))
  }, [indexedPages])

  const handleSelectResult = useCallback((chIdx, page) => {
    setSearchQuery('')
    setSearchResults([])
    setCurChIdx(chIdx)
    setScrollToPage(page)
    setTimeout(() => setScrollToPage(null), 500)
  }, [])

  // Switch book
  const handleSelectBook = useCallback((bookIdx) => {
    setCurBookIdx(bookIdx)
    setCurChIdx(0)
    setSearchQuery('')
    setSearchResults([])
  }, [])

  // Check-in
  const handleCheckin = useCallback(() => {
    const today = new Date().toLocaleDateString('zh-CN')
    const yest = new Date(Date.now() - 864e5).toLocaleDateString('zh-CN')
    if (streak.last === today) { alert('今天已经打卡了！继续加油 🎉'); return }
    const days = streak.last === yest ? streak.days + 1 : 1
    update(s => ({ ...s, streak: { days, last: today } }))
    alert(`打卡成功！连续第 ${days} 天 🔥`)
  }, [streak, update])

  // Toggle chapter done (per-book)
  const handleToggleDone = useCallback(() => {
    update(s => {
      const bd = { ...(s.booksDone || {}) }
      const d = { ...(bd[curBook.id] || {}) }
      if (d[curChIdx]) delete d[curChIdx]
      else d[curChIdx] = 1
      bd[curBook.id] = d
      return { ...s, booksDone: bd }
    })
  }, [curChIdx, curBook.id, update])

  // Memo mode reveal all
  const handleRevealAll = useCallback(() => {
    document.querySelectorAll('.article p, .article li').forEach(el => el.classList.add('show'))
  }, [])

  const showSearch = searchQuery.trim() && searchResults.length >= 0

  return (
    <div className={`app-layout${memoMode ? ' memo-mode' : ''}`}>
      <Sidebar
        books={books}
        curBookIdx={curBookIdx}
        onSelectBook={handleSelectBook}
        chapters={chapters}
        curChIdx={curChIdx}
        done={done}
        streak={streak}
        onSelect={(i) => { setCurChIdx(i); setSidebarOpen(false) }}
        onCheckin={handleCheckin}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main">
        <Toolbar
          searchQuery={searchQuery}
          onSearch={handleSearch}
          streak={streak}
          memoMode={memoMode}
          onToggleMemo={() => setMemoMode(m => !m)}
          onRevealAll={handleRevealAll}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
        />
        <div className="content-wrap">
          {showSearch ? (
            <SearchPanel
              results={searchResults}
              query={searchQuery}
              chapters={chapters}
              onSelect={handleSelectResult}
            />
          ) : (
            <ChapterView
              chapter={chapters[curChIdx]}
              pages={curPages}
              curChIdx={curChIdx}
              totalChapters={chapters.length}
              done={!!done[curChIdx]}
              onToggleDone={handleToggleDone}
              onPrev={() => setCurChIdx(i => i - 1)}
              onNext={() => setCurChIdx(i => i + 1)}
              memoMode={memoMode}
              scrollToPage={scrollToPage}
            />
          )}
        </div>
      </div>
    </div>
  )
}

import { ConfigProvider, theme, Select, Progress, Button, Menu } from 'antd'
import {
  CheckCircleFilled,
  FireFilled,
  CalendarOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'

export default function Sidebar({
  books, curBookIdx, onSelectBook,
  chapters, curChIdx, done, streak, onSelect, onCheckin, isOpen, onClose
}) {
  const today = new Date().toLocaleDateString('zh-CN')
  const checkedInToday = streak?.last === today
  const doneCount = Object.keys(done).length
  const total = chapters.length
  const pct = total ? Math.round((doneCount / total) * 100) : 0

  const bookOptions = books.map((b, i) => ({
    value: i,
    label: b.title,
    subtitle: b.subtitle,
    searchText: `${b.title} ${b.subtitle}`,
  }))

  const chapterItems = chapters.map((ch, i) => ({
    key: String(i),
    icon: done[i] ? <CheckCircleFilled style={{ color: '#16a34a' }} /> : <UnorderedListOutlined />,
    label: <span className="ch-label">{ch.title}</span>,
  }))

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#4f8ef7',
          colorBgBase: '#16213e',
          colorBgContainer: '#16213e',
          colorBgElevated: '#1e3a5f',
          colorBgLayout: '#16213e',
          colorBorder: '#2b4a7a',
          colorBorderSecondary: '#1e3a5f',
          colorText: '#e2e8f0',
          colorTextSecondary: '#94a3b8',
        },
      }}
    >
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <div className={`sidebar${isOpen ? ' open' : ''}`}>
        <div className="sidebar-top">
          <Select
            className="book-select"
            value={curBookIdx}
            options={bookOptions}
            onChange={onSelectBook}
            showSearch
            optionFilterProp="searchText"
            popupMatchSelectWidth={false}
            aria-label="选择书籍"
            optionRender={(option) => (
              <div className="book-option">
                <span className="book-option-title">{option.data.label}</span>
                <span className="book-option-sub">{option.data.subtitle}</span>
              </div>
            )}
          />

          <div className="prog-row">
            <span>学习进度</span>
            <span>{doneCount} / {total} 章</span>
          </div>
          <Progress
            percent={pct}
            showInfo={false}
            size="small"
          />

          <Button
            type="primary"
            block
            icon={checkedInToday ? <CheckCircleFilled /> : <CalendarOutlined />}
            onClick={onCheckin}
          >
            {checkedInToday ? (
              <span>已打卡 · 连续 {streak.days} 天</span>
            ) : (
              <span>今日打卡 <FireFilled /></span>
            )}
          </Button>
        </div>

        <div className="ch-list">
          <Menu
            mode="inline"
            selectedKeys={[String(curChIdx)]}
            items={chapterItems}
            onClick={({ key }) => onSelect(Number(key))}
          />
        </div>
      </div>
    </ConfigProvider>
  )
}

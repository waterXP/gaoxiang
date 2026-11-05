import { Input, Button, Space, Tooltip } from 'antd'
import {
  MenuOutlined,
  SearchOutlined,
  FireFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons'

export default function Toolbar({
  searchQuery, onSearch, streak, memoMode, onToggleMemo, onRevealAll, onToggleSidebar
}) {
  const today = new Date().toLocaleDateString('zh-CN')
  const days = streak?.last === today ? streak.days : (streak?.days || 0)

  return (
    <div className="toolbar">
      <Button
        className="sidebar-toggle"
        icon={<MenuOutlined />}
        onClick={onToggleSidebar}
      />

      <Input
        className="search-input"
        placeholder="搜索知识点…"
        allowClear
        prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.35)' }} />}
        value={searchQuery}
        onChange={e => onSearch(e.target.value)}
        onPressEnter={() => onSearch(searchQuery)}
      />

      {days > 0 && (
        <Tooltip title="连续学习天数">
          <span className="streak"><FireFilled style={{ color: '#f59e0b' }} /> {days} 天</span>
        </Tooltip>
      )}

      <Space size={6}>
        <Button
          type={memoMode ? 'primary' : 'default'}
          icon={memoMode ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={onToggleMemo}
        >
          {memoMode ? '背诵中' : '背诵'}
        </Button>
        {memoMode && (
          <Button icon={<EyeOutlined />} onClick={onRevealAll}>
            显示
          </Button>
        )}
      </Space>
    </div>
  )
}

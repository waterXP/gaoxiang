// 内容类型配置 — 手动可编辑
// 可自由增减类型，修改颜色、图标、描述
// 在各章节文件 (ch_XX.js) 的 type 字段中引用这里的 key

export const CONTENT_TYPES = {
  '重点': {
    label: '重点',
    icon: '⭐',
    color: '#dc2626',   // 文字/边框颜色
    bg: '#fef2f2',      // 背景色
  },
  '难点': {
    label: '难点',
    icon: '🔥',
    color: '#ea580c',
    bg: '#fff7ed',
  },
  '考点': {
    label: '考点',
    icon: '📝',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
  '定义': {
    label: '定义',
    icon: '📖',
    color: '#2563eb',
    bg: '#eff6ff',
  },
  '公式': {
    label: '公式',
    icon: '📐',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  '案例': {
    label: '案例',
    icon: '💼',
    color: '#0891b2',
    bg: '#ecfeff',
  },
  '普通': {
    label: '普通',
    icon: '',
    color: '#6b7280',
    bg: 'transparent',
  },
};

export const DEFAULT_TYPE = '普通';

// 获取类型样式（支持 color 字段覆盖）
export function getTypeStyle(type, customColor) {
  const t = CONTENT_TYPES[type] || CONTENT_TYPES[DEFAULT_TYPE];
  const color = customColor || t.color;
  return { color, bg: t.bg, icon: t.icon, label: t.label };
}

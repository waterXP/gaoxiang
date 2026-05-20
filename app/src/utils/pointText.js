function normalizeInlineText(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\[\[(.*?)\]\]/g, '$1')
    .replace(/\(\((.*?)\)\)/g, '$1')
    .replace(/\{\{point:([^|}]+)\|([^}]+)\}\}/g, '$2')
}

export function extractContentText(items, pointMap = {}) {
  if (!Array.isArray(items)) return ''

  return items
    .map(item => {
      if (typeof item === 'string') {
        return normalizeInlineText(item)
      }

      if (Array.isArray(item)) {
        return extractContentText(item, pointMap)
      }

      if (!item || typeof item !== 'object') {
        return ''
      }

      if (item.point) {
        const point = pointMap[item.point]
        if (!point) return ''
        const prefix = item.prefix || ''
        return `${prefix}${extractContentText(point.content, pointMap)}`
      }

      if (item.text) {
        return normalizeInlineText(item.text)
      }

      if (item.parts) {
        return item.parts
          .map(part => (typeof part === 'string' ? normalizeInlineText(part) : normalizeInlineText(part?.text || '')))
          .join('')
      }

      if (item.items) {
        return extractContentText(item.items, pointMap)
      }

      if (item.rows) {
        return item.rows
          .flat()
          .map(cell => {
            if (typeof cell === 'string') return normalizeInlineText(cell)
            return normalizeInlineText(cell?.text || '')
          })
          .join(' ')
      }

      return ''
    })
    .join(' ')
}


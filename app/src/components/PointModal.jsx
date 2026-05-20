import { renderContent } from '../utils/renderContent.jsx'

export default function PointModal({ point, onClose, onOpenStandalone }) {
  if (!point) return null

  return (
    <div className="point-modal-backdrop" onClick={onClose}>
      <div
        className="point-modal"
        role="dialog"
        aria-modal="true"
        aria-label="知识点详情"
        onClick={event => event.stopPropagation()}
      >
        <div className="point-modal-actions">
          <button type="button" onClick={() => onOpenStandalone(point.id)}>
            单独查看
          </button>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="point-modal-content">
          {renderContent(point.content)}
        </div>
      </div>
    </div>
  )
}


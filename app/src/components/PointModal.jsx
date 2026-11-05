import { Modal, Button, Space } from 'antd'
import { ExpandAltOutlined, CloseOutlined } from '@ant-design/icons'
import { renderContent } from '../utils/renderContent.jsx'

export default function PointModal({ point, onClose, onOpenStandalone, renderImage }) {
  return (
    <Modal
      open={!!point}
      onCancel={onClose}
      footer={null}
      width={min(820, window.innerWidth)}
      title="知识点详情"
      destroyOnClose
    >
      {point && (
        <div style={{ width: '100%' }}>
          <Space style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<ExpandAltOutlined />}
              onClick={() => onOpenStandalone(point.id)}
            >
              单独查看
            </Button>
            <Button icon={<CloseOutlined />} onClick={onClose}>
              关闭
            </Button>
          </Space>
          <div className="point-modal-content">
            {renderContent(point.content, { renderImage })}
          </div>
        </div>
      )}
    </Modal>
  )
}

function min(a, b) {
  return a < b ? a : b
}

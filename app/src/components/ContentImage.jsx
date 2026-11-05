import { Image } from 'antd'
import { ZoomInOutlined } from '@ant-design/icons'

export default function ContentImage({ src, alt = '', className = '', style, imgStyle }) {
  const cls = ['content-image', className].filter(Boolean).join(' ')

  return (
    <div className={cls} style={style}>
      <Image
        src={src}
        alt={alt}
        style={{ borderRadius: 8, ...imgStyle }}
        preview={{
          mask: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ZoomInOutlined /> 查看大图
            </span>
          ),
        }}
      />
    </div>
  )
}

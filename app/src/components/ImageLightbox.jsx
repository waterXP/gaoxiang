import { useEffect, useRef, useState } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 4

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getTouchDistance(touches) {
  const [a, b] = touches
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
}

function getTouchCenter(touches) {
  const [a, b] = touches
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  }
}

export default function ImageLightbox({ image, onClose }) {
  const viewportRef = useRef(null)
  const imageRef = useRef(null)
  const gestureRef = useRef({
    type: null,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startDistance: 0,
    startScale: 1,
    startCenterX: 0,
    startCenterY: 0,
  })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const clampOffset = (nextScale, nextOffset) => {
    const viewport = viewportRef.current
    const img = imageRef.current

    if (!viewport || !img || nextScale <= 1) {
      return { x: 0, y: 0 }
    }

    const viewportRect = viewport.getBoundingClientRect()
    const maxX = Math.max(0, (img.offsetWidth * nextScale - viewportRect.width) / 2)
    const maxY = Math.max(0, (img.offsetHeight * nextScale - viewportRect.height) / 2)

    return {
      x: clamp(nextOffset.x, -maxX, maxX),
      y: clamp(nextOffset.y, -maxY, maxY),
    }
  }

  const applyTransform = (nextScale, nextOffset) => {
    const normalizedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    const normalizedOffset = clampOffset(normalizedScale, nextOffset)
    setScale(normalizedScale)
    setOffset(normalizedOffset)
  }

  useEffect(() => {
    if (!image) return undefined

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    setScale(1)
    setOffset({ x: 0, y: 0 })

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [image, onClose])

  if (!image) return null

  const handleMouseDown = (event) => {
    if (scale <= 1) return
    event.preventDefault()
    gestureRef.current = {
      type: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    }
  }

  const handleMouseMove = (event) => {
    if (gestureRef.current.type !== 'drag') return
    event.preventDefault()
    applyTransform(scale, {
      x: gestureRef.current.startOffsetX + event.clientX - gestureRef.current.startX,
      y: gestureRef.current.startOffsetY + event.clientY - gestureRef.current.startY,
    })
  }

  const handlePointerRelease = () => {
    if (gestureRef.current.type === 'drag') {
      gestureRef.current.type = null
    }
  }

  const handleTouchStart = (event) => {
    if (event.touches.length === 2) {
      const center = getTouchCenter(event.touches)
      gestureRef.current = {
        type: 'pinch',
        startDistance: getTouchDistance(event.touches),
        startScale: scale,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
        startCenterX: center.x,
        startCenterY: center.y,
      }
      return
    }

    if (event.touches.length === 1 && scale > 1) {
      const [touch] = event.touches
      gestureRef.current = {
        type: 'drag',
        startX: touch.clientX,
        startY: touch.clientY,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
      }
    }
  }

  const handleTouchMove = (event) => {
    if (gestureRef.current.type === 'pinch' && event.touches.length === 2) {
      event.preventDefault()
      const nextScale = clamp(
        gestureRef.current.startScale * (getTouchDistance(event.touches) / gestureRef.current.startDistance),
        MIN_SCALE,
        MAX_SCALE,
      )
      const center = getTouchCenter(event.touches)
      const centerDeltaX = center.x - gestureRef.current.startCenterX
      const centerDeltaY = center.y - gestureRef.current.startCenterY

      applyTransform(nextScale, {
        x: gestureRef.current.startOffsetX + centerDeltaX,
        y: gestureRef.current.startOffsetY + centerDeltaY,
      })
      return
    }

    if (gestureRef.current.type === 'drag' && event.touches.length === 1) {
      event.preventDefault()
      const [touch] = event.touches
      applyTransform(scale, {
        x: gestureRef.current.startOffsetX + touch.clientX - gestureRef.current.startX,
        y: gestureRef.current.startOffsetY + touch.clientY - gestureRef.current.startY,
      })
    }
  }

  const handleTouchEnd = () => {
    if (gestureRef.current.type === 'pinch' && scale <= 1) {
      setOffset({ x: 0, y: 0 })
    }
    if (gestureRef.current.type && scale <= 1) {
      applyTransform(1, { x: 0, y: 0 })
    }
    gestureRef.current.type = null
  }

  const handleDoubleClick = () => {
    if (scale > 1) {
      applyTransform(1, { x: 0, y: 0 })
      return
    }
    applyTransform(2, { x: 0, y: 0 })
  }

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="图片预览" onClick={onClose}>
      <button
        type="button"
        className="image-lightbox-close"
        onClick={onClose}
        aria-label="关闭图片预览"
      >
        关闭
      </button>
      <div
        ref={viewportRef}
        className="image-lightbox-viewport"
        onClick={event => event.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseUp={handlePointerRelease}
        onMouseLeave={handlePointerRelease}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imageRef}
          src={image.src}
          alt={image.alt || ''}
          className={`image-lightbox-image${scale > 1 ? ' is-zoomed' : ''}`}
          draggable="false"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          }}
        />
      </div>
      <div className="image-lightbox-toolbar" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => applyTransform(scale - 0.5, offset)} aria-label="缩小">
          -
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => applyTransform(scale + 0.5, offset)} aria-label="放大">
          +
        </button>
        <button type="button" onClick={() => applyTransform(1, { x: 0, y: 0 })}>
          重置
        </button>
      </div>
    </div>
  )
}

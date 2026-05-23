export default function ContentImage({ src, alt = '', onOpen, className = '', style, imgStyle }) {
  const buttonClassName = ['content-image', className].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={buttonClassName}
      style={style}
      onClick={() => onOpen?.({ src, alt })}
      aria-label="查看大图"
    >
      <img
        src={src}
        alt={alt}
        className="content-image-thumb"
        style={imgStyle}
      />
      <span className="content-image-hint">点击查看大图</span>
    </button>
  )
}

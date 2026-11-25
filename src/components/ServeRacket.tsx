type ServeRacketProps = {
  className?: string;
  title?: string;
  /** Pixel size (width & height). Default 28. */
  size?: number;
  /** Kept for callers; image is only rendered for the server. */
  active?: boolean;
};

const SERVE_IMAGE_SRC = '/Badminton_service_rules.jpg';

/**
 * Serve indicator photo — render only for the side that is serving.
 * Stateless; safe under concurrent React renders.
 */
export function ServeRacket({
  className = '',
  title = 'Serving',
  size = 28
}: ServeRacketProps) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 28;

  return (
    <img
      src={SERVE_IMAGE_SRC}
      alt={title}
      title={title}
      width={safeSize}
      height={safeSize}
      className={`object-cover rounded-md shrink-0 opacity-100 ${className}`.trim()}
      style={{
        width: safeSize,
        height: safeSize,
        boxShadow: '0 0 0 2px rgba(52, 211, 153, 0.7)'
      }}
      draggable={false}
    />
  );
}

export default ServeRacket;

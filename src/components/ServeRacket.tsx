type ServeRacketProps = {
  /** When true, indicator is highlighted as the active server */
  active?: boolean;
  className?: string;
  title?: string;
  /** Pixel size (width & height). Default 28. */
  size?: number;
};

const SERVE_IMAGE_SRC = '/Badminton_service_rules.jpg';

/**
 * Serve indicator using the badminton service photo.
 * Stateless; safe under concurrent React renders.
 */
export function ServeRacket({
  active = false,
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
      className={`object-cover rounded-md shrink-0 ${active ? 'opacity-100' : 'opacity-40'} ${className}`.trim()}
      style={{
        width: safeSize,
        height: safeSize,
        boxShadow: active ? '0 0 0 2px rgba(52, 211, 153, 0.7)' : undefined
      }}
      draggable={false}
    />
  );
}

export default ServeRacket;

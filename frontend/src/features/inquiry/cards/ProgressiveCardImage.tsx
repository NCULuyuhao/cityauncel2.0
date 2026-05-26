export function ProgressiveCardImage({
  src,
  alt,
  className,
  priority = false,
  ariaHidden = false,
}: {
  src: string;
  alt: string;
  className: string;
  shouldLoad?: boolean;
  priority?: boolean;
  ariaHidden?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={ariaHidden || alt === "" ? "true" : undefined}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={className}
    />
  );
}

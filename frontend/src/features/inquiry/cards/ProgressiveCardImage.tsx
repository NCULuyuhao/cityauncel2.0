/**
 * CityAuncel maintainability notes
 * 檔案用途：探究資料卡模組 ProgressiveCardImage，處理資料卡清單、篩選、呈現或送出資料格式。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

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

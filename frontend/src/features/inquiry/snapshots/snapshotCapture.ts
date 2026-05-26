import { toCanvas } from "html-to-image";

const SNAPSHOT_SAFE_BACKGROUND_COLOR = "rgb(255, 250, 240)";
const SNAPSHOT_IMAGE_MIME_TYPE = "image/webp";
const SNAPSHOT_IMAGE_QUALITY = 0.82;

const SNAPSHOT_CAPTURE_STYLE_ID = "cityauncel-snapshot-safe-render-style";
const SNAPSHOT_CAPTURE_ATTRIBUTE = "data-snapshot-capturing";

function ensureSnapshotSafeRenderStyle() {
  if (document.getElementById(SNAPSHOT_CAPTURE_STYLE_ID)) return;

  const styleEl = document.createElement("style");
  styleEl.id = SNAPSHOT_CAPTURE_STYLE_ID;
  styleEl.textContent = `
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"],
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] * {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }

    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] svg,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] svg *,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .miaoli-district-selector-map__overlay-path,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .miaoli-district-selector-map__marker-label-bg,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .miaoli-district-selector-map__piece,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .miaoli-district-selector-map__shape,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .water-rpi-river-map__river-area,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .water-rpi-river-map__marker-label-bg {
      filter: none !important;
      -webkit-filter: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      mix-blend-mode: normal !important;
      transform: none !important;
      opacity: 1;
    }

    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .miaoli-district-selector-map__map-frame,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .water-rpi-river-map,
    [${SNAPSHOT_CAPTURE_ATTRIBUTE}="true"] .miaoli-district-selector-map {
      background-color: ${SNAPSHOT_SAFE_BACKGROUND_COLOR} !important;
    }
  `;
  document.head.appendChild(styleEl);
}

function setSnapshotSafeSvgAttributes(root: HTMLElement) {
  const changedElements: Array<{ element: Element; previous: string | null }> =
    [];

  root.querySelectorAll<SVGElement>("svg, svg *").forEach((element) => {
    const previous = element.getAttribute("filter");
    changedElements.push({ element, previous });
    element.removeAttribute("filter");
  });

  return () => {
    changedElements.forEach(({ element, previous }) => {
      if (previous === null) element.removeAttribute("filter");
      else element.setAttribute("filter", previous);
    });
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("讀取快照圖片失敗"));
    reader.readAsDataURL(blob);
  });
}

async function canvasToSnapshotDataUrl(canvas: HTMLCanvasElement) {
  const webpDataUrl = canvas.toDataURL(
    SNAPSHOT_IMAGE_MIME_TYPE,
    SNAPSHOT_IMAGE_QUALITY,
  );
  if (webpDataUrl.startsWith(`data:${SNAPSHOT_IMAGE_MIME_TYPE}`)) {
    return webpDataUrl;
  }

  const webpBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, SNAPSHOT_IMAGE_MIME_TYPE, SNAPSHOT_IMAGE_QUALITY);
  });
  if (webpBlob?.type === SNAPSHOT_IMAGE_MIME_TYPE) {
    const dataUrl = await blobToDataUrl(webpBlob);
    if (dataUrl.startsWith(`data:${SNAPSHOT_IMAGE_MIME_TYPE}`)) return dataUrl;
  }

  // 少數舊瀏覽器不支援 WebP canvas 輸出時，才退回 JPEG，後端仍會用副檔名區分。
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function waitForUiSequence(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export async function captureElementAsImageDataUrl(element: HTMLElement) {
  await document.fonts?.ready?.catch?.(() => undefined);
  ensureSnapshotSafeRenderStyle();

  const previousSnapshotAttribute = element.getAttribute(
    SNAPSHOT_CAPTURE_ATTRIBUTE,
  );
  const restoreSvgAttributes = setSnapshotSafeSvgAttributes(element);
  element.setAttribute(SNAPSHOT_CAPTURE_ATTRIBUTE, "true");

  try {
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => resolve()),
      ),
    );

    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));
    const pixelRatio = Math.max(
      1,
      Math.min(window.devicePixelRatio || 1, 1.35),
    );
    const canvas = await toCanvas(element, {
      backgroundColor: SNAPSHOT_SAFE_BACKGROUND_COLOR,
      width,
      height,
      canvasWidth: Math.round(width * pixelRatio),
      canvasHeight: Math.round(height * pixelRatio),
      pixelRatio,
      cacheBust: false,
      skipAutoScale: true,
      filter: (node) => {
        return !(
          node instanceof HTMLElement && node.dataset.snapshotIgnore === "true"
        );
      },
      style: {
        margin: "0",
        background: SNAPSHOT_SAFE_BACKGROUND_COLOR,
        filter: "none",
        webkitFilter: "none",
        transform: "none",
      },
    });

    return canvasToSnapshotDataUrl(canvas);
  } finally {
    restoreSvgAttributes();
    if (previousSnapshotAttribute === null) {
      element.removeAttribute(SNAPSHOT_CAPTURE_ATTRIBUTE);
    } else {
      element.setAttribute(
        SNAPSHOT_CAPTURE_ATTRIBUTE,
        previousSnapshotAttribute,
      );
    }
  }
}

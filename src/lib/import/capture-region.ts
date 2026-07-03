import { toCanvas } from "html-to-image";
import html2canvas from "html2canvas-pro";

export interface RegionRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const MIN_CAPTURE_PX = 24;

export function normalizeRect(rect: RegionRect): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const left = Math.min(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const width = Math.abs(rect.x2 - rect.x1);
  const height = Math.abs(rect.y2 - rect.y1);
  return { left, top, width, height };
}

/** Position within element using viewport coords (works with ancestor scroll). */
export function clientToElementCoords(
  element: HTMLElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const bounds = element.getBoundingClientRect();
  return {
    x: clientX - bounds.left,
    y: clientY - bounds.top,
  };
}

function isCanvasMostlyBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width === 0 || canvas.height === 0) return true;

  const w = Math.min(canvas.width, 120);
  const h = Math.min(canvas.height, 120);
  const data = ctx.getImageData(0, 0, w, h).data;

  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 245 || g < 245 || b < 245) ink++;
  }

  return ink < 12;
}

async function renderViewport(
  viewport: HTMLElement,
  pixelRatio: number
): Promise<HTMLCanvasElement> {
  try {
    return await toCanvas(viewport, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
  } catch {
    return html2canvas(viewport, {
      scale: pixelRatio,
      backgroundColor: "#ffffff",
      logging: false,
    });
  }
}

async function renderFullAndCrop(
  element: HTMLElement,
  rect: RegionRect,
  pixelRatio: number
): Promise<HTMLCanvasElement> {
  const { left, top, width, height } = normalizeRect(rect);

  const full = await toCanvas(element, {
    pixelRatio,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });

  const crop = document.createElement("canvas");
  crop.width = Math.round(width * pixelRatio);
  crop.height = Math.round(height * pixelRatio);

  const ctx = crop.getContext("2d");
  if (!ctx) throw new Error("Could not create capture canvas");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.drawImage(
    full,
    Math.round(left * pixelRatio),
    Math.round(top * pixelRatio),
    Math.round(width * pixelRatio),
    Math.round(height * pixelRatio),
    0,
    0,
    crop.width,
    crop.height
  );

  return crop;
}

function buildViewportClone(
  element: HTMLElement,
  rect: RegionRect
): HTMLElement {
  const { left, top, width, height } = normalizeRect(rect);

  const viewport = document.createElement("div");
  viewport.setAttribute("data-capture-viewport", "true");
  viewport.style.cssText = [
    "position: fixed",
    "left: -20000px",
    "top: 0",
    `width: ${width}px`,
    `height: ${height}px`,
    "overflow: hidden",
    "background: #ffffff",
    "pointer-events: none",
    "z-index: -1",
  ].join(";");

  const shifted = document.createElement("div");
  shifted.style.cssText = [
    "position: relative",
    `width: ${element.offsetWidth}px`,
    `margin-left: ${-left}px`,
    `margin-top: ${-top}px`,
  ].join(";");

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.boxShadow = "none";
  clone.style.margin = "0";

  shifted.appendChild(clone);
  viewport.appendChild(shifted);

  return viewport;
}

/** Capture a region of a document element as a PNG data URL. */
export async function captureElementRegion(
  element: HTMLElement,
  rect: RegionRect
): Promise<string> {
  const { width, height } = normalizeRect(rect);

  if (width < MIN_CAPTURE_PX || height < MIN_CAPTURE_PX) {
    throw new Error("Selection too small — drag a larger area");
  }

  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  const viewport = buildViewportClone(element, rect);
  document.body.appendChild(viewport);

  try {
    let canvas = await renderViewport(viewport, pixelRatio);

    if (isCanvasMostlyBlank(canvas)) {
      canvas = await renderFullAndCrop(element, rect, pixelRatio);
    }

    if (isCanvasMostlyBlank(canvas)) {
      canvas = await html2canvas(element, {
        scale: pixelRatio,
        backgroundColor: "#ffffff",
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      }).then((full) => {
        const { left, top, width: w, height: h } = normalizeRect(rect);
        const crop = document.createElement("canvas");
        crop.width = Math.round(w * pixelRatio);
        crop.height = Math.round(h * pixelRatio);
        const ctx = crop.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, crop.width, crop.height);
        ctx.drawImage(
          full,
          Math.round(left * pixelRatio),
          Math.round(top * pixelRatio),
          Math.round(w * pixelRatio),
          Math.round(h * pixelRatio),
          0,
          0,
          crop.width,
          crop.height
        );
        return crop;
      });
    }

    if (isCanvasMostlyBlank(canvas)) {
      throw new Error(
        "Capture appears blank — try selecting a slightly larger area around the text"
      );
    }

    return canvas.toDataURL("image/png");
  } finally {
    viewport.remove();
  }
}

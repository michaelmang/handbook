"use client";

import {
  useCallback,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  captureElementRegion,
  clientToElementCoords,
  type RegionRect,
} from "@/lib/import/capture-region";

interface WordDocumentViewerProps {
  html: string;
  disabled?: boolean;
  onCapture: (imageDataUrl: string) => void;
  onCaptureError: (message: string) => void;
}

export function WordDocumentViewer({
  html,
  disabled = false,
  onCapture,
  onCaptureError,
}: WordDocumentViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<RegionRect | null>(null);
  const [capturing, setCapturing] = useState(false);

  const handleMouseDown = (e: ReactMouseEvent) => {
    if (disabled || capturing || e.button !== 0) return;
    const el = captureRef.current;
    if (!el) return;
    const { x, y } = clientToElementCoords(el, e.clientX, e.clientY);
    setMarquee({ x1: x, y1: y, x2: x, y2: y });
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!marquee || capturing) return;
    const el = captureRef.current;
    if (!el) return;
    const { x, y } = clientToElementCoords(el, e.clientX, e.clientY);
    setMarquee((m) => (m ? { ...m, x2: x, y2: y } : null));
  };

  const finishCapture = useCallback(async () => {
    if (!marquee || !captureRef.current) return;
    const rect = { ...marquee };
    setMarquee(null);
    setCapturing(true);
    try {
      const image = await captureElementRegion(captureRef.current, rect);
      onCapture(image);
    } catch (err) {
      onCaptureError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setCapturing(false);
    }
  }, [marquee, onCapture, onCaptureError]);

  const handleMouseUp = () => {
    if (!marquee || capturing) return;
    void finishCapture();
  };

  const marqueeStyle = marquee
    ? {
        left: Math.min(marquee.x1, marquee.x2),
        top: Math.min(marquee.y1, marquee.y2),
        width: Math.abs(marquee.x2 - marquee.x1),
        height: Math.abs(marquee.y2 - marquee.y1),
      }
    : null;

  return (
    <div
      ref={scrollRef}
      className={`relative min-h-0 flex-1 overflow-auto p-6 ${
        disabled || capturing ? "cursor-wait" : "cursor-crosshair"
      }`}
      style={{ backgroundColor: "#e7e5e4" }}
      onMouseLeave={() => {
        if (marquee && !capturing) setMarquee(null);
      }}
    >
      <div className="relative mx-auto max-w-[8.5in] shadow-lg">
        <div
          ref={captureRef}
          className="docx-document"
          style={{
            position: "relative",
            backgroundColor: "#ffffff",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div
            className="docx-document-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        {marqueeStyle && marqueeStyle.width > 2 && marqueeStyle.height > 2 && (
          <>
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: marqueeStyle.left,
                top: marqueeStyle.top,
                width: marqueeStyle.width,
                height: marqueeStyle.height,
                border: "2px solid #0ea5e9",
                backgroundColor: "rgba(14, 165, 233, 0.15)",
              }}
            />
            <div
              className="pointer-events-none absolute z-30"
              style={{
                left: marqueeStyle.left,
                top: Math.max(0, marqueeStyle.top - 22),
                padding: "2px 8px",
                borderRadius: 4,
                backgroundColor: "rgba(28, 25, 23, 0.75)",
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              Release to capture
            </div>
          </>
        )}

        {capturing && (
          <div
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
          >
            <span
              style={{
                borderRadius: 8,
                backgroundColor: "#1c1917",
                color: "#ffffff",
                padding: "8px 16px",
                fontSize: 14,
              }}
            >
              Capturing…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

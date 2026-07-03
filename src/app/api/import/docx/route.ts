import { NextRequest, NextResponse } from "next/server";
import { convertDocxToHtml } from "@/lib/import/docx-render";
import {
  encodeStreamLine,
  type ImportProgressEvent,
} from "@/lib/import/import-progress";

export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".docx")) {
      return NextResponse.json(
        { error: "Only .docx files are supported" },
        { status: 400 }
      );
    }

    if (
      file.type &&
      !ALLOWED_TYPES.has(file.type) &&
      file.type !== ""
    ) {
      return NextResponse.json(
        { error: "Invalid file type. Upload a Word .docx file." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mode = formData.get("mode")?.toString() ?? "auto";

    if (mode === "visual") {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const emit = (event: ImportProgressEvent) => {
            controller.enqueue(encoder.encode(encodeStreamLine(event)));
          };

          try {
            emit({
              phase: "read",
              status: "complete",
              message: "Document loaded",
            });
            emit({
              phase: "extract",
              status: "start",
              message: "Rendering document",
            });

            const { html, warnings } = await convertDocxToHtml(buffer);

            emit({
              phase: "extract",
              status: "complete",
              message: "Document ready",
            });
            emit({
              phase: "done",
              status: "complete",
              message: "Drag to capture sections",
            });

            controller.enqueue(
              encoder.encode(
                encodeStreamLine({
                  type: "complete",
                  result: { visual: true, html, warnings, blocks: [] },
                })
              )
            );
            controller.close();
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to render document";
            controller.enqueue(
              encoder.encode(encodeStreamLine({ type: "error", error: message }))
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    const { buildImportDraft } = await import("@/lib/import/build-import-draft");
    const useSmart = formData.get("smart") === "true";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const emit = (event: ImportProgressEvent) => {
          controller.enqueue(encoder.encode(encodeStreamLine(event)));
        };

        try {
          const result = await buildImportDraft(buffer, emit, useSmart);
          controller.enqueue(
            encoder.encode(encodeStreamLine({ type: "complete", result }))
          );
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to parse document";
          controller.enqueue(
            encoder.encode(encodeStreamLine({ type: "error", error: message }))
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("DOCX import error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to parse document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

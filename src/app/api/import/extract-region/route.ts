import { NextRequest, NextResponse } from "next/server";
import { extractSectionFromImage } from "@/lib/import/llm-vision-section";

export const maxDuration = 60;

const MAX_IMAGE_CHARS = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { image?: string };

    if (!body.image || typeof body.image !== "string") {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    if (body.image.length > MAX_IMAGE_CHARS) {
      return NextResponse.json({ error: "Image too large" }, { status: 400 });
    }

    const result = await extractSectionFromImage(body.image);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Vision extract error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to extract section";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

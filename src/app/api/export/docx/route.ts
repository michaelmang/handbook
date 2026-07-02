import { NextRequest, NextResponse } from "next/server";
import type { Project } from "@/lib/types";
import { generateDocx } from "@/lib/export/docx";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const project = body.project as Project;

    if (!project?.id || !project?.name) {
      return NextResponse.json({ error: "Invalid project data" }, { status: 400 });
    }

    const docxBuffer = await generateDocx(project);
    const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("DOCX export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Word document" },
      { status: 500 }
    );
  }
}

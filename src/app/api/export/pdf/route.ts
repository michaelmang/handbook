import { NextRequest, NextResponse } from "next/server";
import type { Project } from "@/lib/types";
import { generatePdf } from "@/lib/export/pdf";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const project = body.project as Project;

    if (!project?.id || !project?.name) {
      return NextResponse.json({ error: "Invalid project data" }, { status: 400 });
    }

    const pdfBuffer = await generatePdf(project);
    const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF. Ensure Chrome is available locally for development." },
      { status: 500 }
    );
  }
}

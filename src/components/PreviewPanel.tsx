"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useProject } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { organizeProject } from "@/lib/project-utils";
import { isContainerSection, headingLevelForDepth } from "@/lib/section-tree";
import { stripLeadingHeading } from "@/lib/markdown";

interface PreviewPanelProps {
  projectId: string;
}

const HEADING_SIZES = ["28pt", "22pt", "18pt", "16pt", "14pt", "13pt"];

export function PreviewPanel({ projectId }: PreviewPanelProps) {
  const project = useProject(projectId);
  const items = useMemo(
    () => (project ? organizeProject(project, { includedOnly: true }) : []),
    [project]
  );

  if (!project) return null;

  const template = TEMPLATES[project.templateId];
  const { schoolName, logoDataUrl, accentColor, coverPageText } =
    project.branding;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
        Add and include sections to see a preview of your handbook.
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-stone-200/50 p-6">
      <div
        className="w-full max-w-[8.5in] bg-white shadow-lg"
        style={{
          fontFamily: template.bodyFont,
          fontSize: project.templateId === "compact" ? "10.5pt" : "11pt",
          lineHeight: project.templateId === "compact" ? 1.45 : 1.6,
          color: "#1a1a1a",
        }}
      >
        <div
          className="border-b border-stone-100 px-16 py-20"
          style={{
            textAlign: template.coverStyle === "centered" ? "center" : "left",
          }}
        >
          {logoDataUrl && (
            <img
              src={logoDataUrl}
              alt="Logo"
              className="mx-auto mb-8 max-h-24 max-w-[180px] object-contain"
              style={{
                marginLeft: template.coverStyle === "centered" ? "auto" : 0,
                marginRight:
                  template.coverStyle === "centered" ? "auto" : undefined,
              }}
            />
          )}
          <h1
            className="mb-2 font-bold"
            style={{
              fontFamily: template.headingFont,
              fontSize: project.templateId === "compact" ? "24pt" : "28pt",
              color: accentColor,
            }}
          >
            {schoolName || "School Name"}
          </h1>
          <h2
            style={{
              fontFamily: template.headingFont,
              fontSize: project.templateId === "compact" ? "18pt" : "20pt",
              color: "#333",
            }}
          >
            {project.name}
          </h2>
          {coverPageText && (
            <p className="mt-6 text-stone-500" style={{ fontSize: "11pt" }}>
              {coverPageText}
            </p>
          )}
        </div>

        <div className="border-b border-stone-100 px-16 py-12">
          <h2
            className="mb-6 border-b-2 pb-2 font-bold"
            style={{
              fontFamily: template.headingFont,
              fontSize: "16pt",
              color: accentColor,
              borderColor: accentColor,
            }}
          >
            Table of Contents
          </h2>
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li
                key={item.section.id}
                className={`text-stone-700 ${
                  isContainerSection(item.section) ? "font-semibold" : ""
                }`}
                style={{
                  paddingLeft: `${item.depth * 1.25}rem`,
                  color: isContainerSection(item.section)
                    ? accentColor
                    : undefined,
                }}
              >
                <span className="mr-2 font-mono text-xs text-stone-400">
                  {item.number}
                </span>
                {item.section.title}
              </li>
            ))}
          </ul>
        </div>

        {items.map((item) => {
          const level = headingLevelForDepth(item.depth);
          const fontSize =
            HEADING_SIZES[Math.min(level - 1, HEADING_SIZES.length - 1)];
          const isContainer = isContainerSection(item.section);

          if (isContainer) {
            return (
              <div
                key={item.section.id}
                className="border-t border-stone-100 px-16 py-8"
              >
                <div
                  className="font-bold"
                  style={{
                    fontFamily: template.headingFont,
                    fontSize,
                    color: accentColor,
                    borderBottom:
                      item.depth === 0 ? `2px solid ${accentColor}` : undefined,
                    paddingBottom: item.depth === 0 ? "0.5rem" : undefined,
                  }}
                >
                  <span className="mr-2 font-mono text-sm font-normal text-stone-400">
                    {item.number}
                  </span>
                  {item.section.title}
                </div>
              </div>
            );
          }

          const content = stripLeadingHeading(item.section.markdownContent);
          return (
            <div
              key={item.section.id}
              className="border-t border-stone-100 px-16 py-10"
            >
              <div
                className="mb-4 border-b border-stone-200 pb-2 font-bold"
                style={{
                  fontFamily: template.headingFont,
                  fontSize,
                  color: accentColor,
                }}
              >
                <span className="mr-2 font-mono text-sm font-normal text-stone-400">
                  {item.number}
                </span>
                {item.section.title}
              </div>
              <div
                className="prose-handbook max-w-none"
                style={{ "--accent": accentColor } as React.CSSProperties}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import type { TemplateId } from "./types";

export interface TemplatePreset {
  id: TemplateId;
  name: string;
  description: string;
  headingFont: string;
  bodyFont: string;
  coverStyle: "centered" | "left-aligned" | "minimal";
}

export const TEMPLATES: Record<TemplateId, TemplatePreset> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Traditional serif typography for formal handbooks",
    headingFont: "'Libre Baskerville', Georgia, serif",
    bodyFont: "'Libre Baskerville', Georgia, serif",
    coverStyle: "centered",
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Clean sans-serif layout with generous whitespace",
    headingFont: "'DM Sans', system-ui, sans-serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    coverStyle: "left-aligned",
  },
  compact: {
    id: "compact",
    name: "Compact",
    description: "Dense layout suited to longer policy documents",
    headingFont: "'Source Serif 4', Georgia, serif",
    bodyFont: "'Source Serif 4', Georgia, serif",
    coverStyle: "minimal",
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export const DEFAULT_ACCENT_COLORS = [
  "#1e3a5f",
  "#2d5016",
  "#7c2d12",
  "#4c1d95",
  "#0f4c5c",
];

export type ImportProgressPhase =
  | "read"
  | "extract"
  | "features"
  | "pass_a"
  | "audit"
  | "pass_b"
  | "build"
  | "done"
  | "error";

export type ImportProgressStatus = "start" | "progress" | "complete" | "skip";

export interface ImportProgressEvent {
  phase: ImportProgressPhase;
  status: ImportProgressStatus;
  message: string;
  detail?: string;
  current?: number;
  total?: number;
}

export type ImportProgressReporter = (event: ImportProgressEvent) => void;

export function noopProgress(_event: ImportProgressEvent): void {}

export function encodeProgressLine(event: ImportProgressEvent): string {
  return `${JSON.stringify(event)}\n`;
}

import type { DocxImportResult } from "./import-draft-types";

export interface ImportCompleteLine {
  type: "complete";
  result: DocxImportResult;
}

export interface ImportErrorLine {
  type: "error";
  error: string;
}

export type ImportStreamLine =
  | ImportProgressEvent
  | ImportCompleteLine
  | ImportErrorLine;

export function encodeStreamLine(line: ImportStreamLine): string {
  return `${JSON.stringify(line)}\n`;
}

export function isCompleteLine(
  line: ImportStreamLine
): line is ImportCompleteLine {
  return "type" in line && line.type === "complete";
}

export function isErrorLine(line: ImportStreamLine): line is ImportErrorLine {
  return "type" in line && line.type === "error";
}

export type TemplateId = "classic" | "modern" | "compact";

export interface Branding {
  schoolName: string;
  logoDataUrl: string | null;
  accentColor: string;
  coverPageText: string;
}

export interface Section {
  id: string;
  parentId: string | null;
  title: string;
  markdownContent: string;
  orderIndex: number;
  included: boolean;
}

export interface Project {
  id: string;
  name: string;
  templateId: TemplateId;
  branding: Branding;
  sections: Section[];
  createdAt: string;
  updatedAt: string;
}

export interface ExportPayload {
  project: Project;
}

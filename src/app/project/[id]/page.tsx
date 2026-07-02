import { ProjectEditor } from "@/components/ProjectEditor";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  return <ProjectEditor projectId={id} />;
}

import { TaskCreateForm } from "@/components/tasks/TaskCreateForm";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/rbac";
import { notFound } from "next/navigation";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const user = await requirePageUser(["HR", "SUPER_ADMIN"]);
  const { templateId } = await searchParams;
  if (!templateId) notFound();

  // spec 3.1: fields belong to TemplateVersion; task creation uses the latest
  // published version.
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      versions: {
        where: { status: "PUBLISHED" },
        orderBy: { version: "desc" },
        take: 1,
        include: { fields: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  const version = template?.versions[0];
  if (!template || !version) notFound();

  return (
    <TaskCreateForm
      template={{
        id: template.id,
        name: template.name,
        category: template.category,
        fields: version.fields.map((f) => ({
          id: f.id,
          type: f.type,
          label: f.label,
          required: f.required,
          placeholder: f.defaultValue,
        })),
      }}
      operatorName={user.name}
    />
  );
}

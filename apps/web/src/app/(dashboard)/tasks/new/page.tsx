import { TaskCreateForm } from "@/components/tasks/TaskCreateForm";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/rbac";
import { notFound } from "next/navigation";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string; fromTaskId?: string }>;
}) {
  const user = await requirePageUser(["HR", "SUPER_ADMIN"]);
  const { templateId: templateIdParam, fromTaskId } = await searchParams;

  let templateId = templateIdParam;
  let initialTitle: string | undefined;
  let initialSigners:
    | Array<{
        signRole: "APPROVER" | "COMPANY_SEAL" | "PERSONAL_SIGNATURE";
        userId?: string;
        externalFullName?: string;
        externalEmail?: string;
      }>
    | undefined;

  if (fromTaskId) {
    const source = await prisma.signingTask.findUnique({
      where: { id: fromTaskId },
      include: {
        document: { select: { templateVersion: { select: { templateId: true } } } },
        signers: { orderBy: { order: "asc" } },
      },
    });
    if (!source) notFound();
    templateId = source.document.templateVersion.templateId;
    initialTitle = `${source.title} (reissue)`;
    initialSigners = source.signers.map((s) => ({
      signRole: s.signRole as "APPROVER" | "COMPANY_SEAL" | "PERSONAL_SIGNATURE",
      userId: s.userId ?? undefined,
      externalFullName: s.externalFullName ?? undefined,
      externalEmail: s.externalEmail ?? undefined,
    }));
  }

  if (!templateId) notFound();

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
      initialTitle={initialTitle}
      initialSigners={initialSigners}
    />
  );
}

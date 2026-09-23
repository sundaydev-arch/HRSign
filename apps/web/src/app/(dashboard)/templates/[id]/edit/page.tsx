import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/rbac";
import { DocumentContentSchema } from "@/schemas/document-content";
import { notFound } from "next/navigation";

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["HR", "SUPER_ADMIN"]);
  const { id } = await params;
  const template = await prisma.template.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { fields: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      },
    },
  });
  const version = template?.versions[0];
  if (!template || !version) notFound();

  if (version.editorMode === "DOCUMENT") {
    const { DocumentEditorLazy } = await import("@/components/docs/DocumentEditorLazy");
    const parsed = DocumentContentSchema.safeParse(version.contentJson);
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DocumentEditorLazy
          templateId={template.id}
          templateName={template.name}
          initialContent={parsed.success ? parsed.data : null}
          versionStatus={version.status}
          versionNumber={version.version}
        />
      </div>
    );
  }

  const { TemplateEditorLazy } = await import("@/components/pdf/TemplateEditorLazy");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TemplateEditorLazy
        templateId={template.id}
        templateName={template.name}
        fileUrl={`/api/files/${version.storageKey}`}
        pageCount={version.pageCount}
        initialFields={version.fields}
        versionStatus={version.status}
        versionNumber={version.version}
      />
    </div>
  );
}

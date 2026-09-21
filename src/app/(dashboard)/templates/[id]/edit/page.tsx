import { PageHeader } from "@/components/layout/PageHeader";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/rbac";
import { TemplateEditor } from "@/components/pdf/TemplateEditor";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["HR", "SUPER_ADMIN"]);
  const { id } = await params;
  // spec 3.1: fields and files belong to TemplateVersion; the editor operates
  // on the latest version (saves after publication/archival are rejected by
  // the backend).
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

  const t = await getTranslations("templateEdit");

  return (
    <div className="space-y-4">
      <PageHeader title={t("title", { name: template.name })} description={t("subtitle")} />
      <TemplateEditor
        templateId={template.id}
        fileUrl={`/api/files/${version.storageKey}`}
        pageCount={version.pageCount}
        initialFields={version.fields}
      />
    </div>
  );
}

import { redirect } from "next/navigation";

/** Short signing link → external sign surface (same token param). */
export default async function ShortSignPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/sign/external/${encodeURIComponent(code)}`);
}

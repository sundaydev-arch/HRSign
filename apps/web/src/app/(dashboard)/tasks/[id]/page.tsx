import { requirePageUser } from "@/lib/rbac";
import { TaskDetail } from "@/components/tasks/TaskDetail";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;
  return <TaskDetail taskId={id} />;
}

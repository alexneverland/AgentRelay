import Workspace from '@/components/workspace';
import Setup from '@/components/setup';
export default async function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? (
    <Workspace threadId={id} />
  ) : (
    <Setup />
  );
}

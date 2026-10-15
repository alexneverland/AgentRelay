import Workspace from '@/components/workspace';
import Setup from '@/components/setup';
export default function Home() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? (
    <Workspace />
  ) : (
    <Setup />
  );
}

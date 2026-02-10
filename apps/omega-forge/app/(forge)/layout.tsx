import { ForgeSidebar } from '@/components/layout/forge-sidebar';

export default function ForgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <ForgeSidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-950">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

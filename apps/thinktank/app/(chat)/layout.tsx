import { TooltipProvider } from '@/components/ui/tooltip';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      {children}
    </TooltipProvider>
  );
}

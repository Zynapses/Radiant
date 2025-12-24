export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-radiant-50 to-radiant-100 dark:from-radiant-950 dark:to-gray-900">
      <div className="w-full max-w-md p-8">
        {children}
      </div>
    </div>
  );
}

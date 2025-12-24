import './globals.css';

export const metadata = {
  title: 'RADIANT Chatbot',
  description: 'A chatbot powered by RADIANT',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

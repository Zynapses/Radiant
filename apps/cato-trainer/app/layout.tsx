import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cato Trainer — The Grounding Engine',
  description: 'AI-powered knowledge base delivering instant, citable responses with 100% ground-truth accuracy from your document library. Powered by the Cato persona.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <div className="min-h-screen cato-mesh">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

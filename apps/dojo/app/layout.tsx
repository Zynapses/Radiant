import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Aurelius Dojo — Thematic Mastery Training',
  description: 'Agent-powered training platform for RADIANT Think Tank. Master policies, procedures, and domain expertise through thematic immersion and adversarial sparring.',
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
          <div className="min-h-screen tatami-pattern">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OMEGA Lab - Brain Management',
  description: 'OMEGA Lab - Create, Monitor, and Manage OMEGA Neural Networks',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <Providers>
          <div className="min-h-screen grid-pattern">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from './providers';

// Using system fonts instead of Google Fonts for offline builds
// When network is available, you can switch to: import { Inter } from 'next/font/google';
const inter = {
  className: 'font-sans',
};

export const metadata: Metadata = {
  title: {
    template: '%s | Sellergo',
    default: 'Sellergo - E-commerce Platform',
  },
  description: 'COD-optimized e-commerce platform for Tunisia and North Africa',
  keywords: ['e-commerce', 'COD', 'Tunisia', 'online store', 'dropshipping'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

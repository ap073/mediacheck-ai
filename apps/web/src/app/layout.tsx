import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MediaCheck AI — Is This Image or Video AI-Generated?',
  description:
    'Detect signals of AI-generated images and videos using deep-learning artifacts detection and Content Credentials (C2PA) provenance inspection.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seminar Flow - Power Mailers Plus',
  description: 'Seminar marketing management portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}

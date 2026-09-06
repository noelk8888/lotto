import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PH-Lotto-Checker — PCSO Ticket Checker',
  description: 'Compare Philippine PCSO lotto ticket numbers with official draw results.',
  icons: {
    icon: '/app-logo.jpg',
    apple: '/app-logo.jpg',
    shortcut: '/app-logo.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

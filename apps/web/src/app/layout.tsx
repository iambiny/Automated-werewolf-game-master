import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './styles.css';

export const metadata: Metadata = {
  description: 'A single-device game master for physical-card Werewolf.',
  manifest: '/manifest.webmanifest',
  title: 'Automated Werewolf Game Master',
};

export const viewport = {
  colorScheme: 'dark',
  themeColor: '#090b12',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

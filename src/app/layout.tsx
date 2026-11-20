import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans, Amiri, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { AppShellProvider } from '@/components/providers/app-shell-provider';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-fr',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans-fr',
  display: 'swap',
});

const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-display-ar',
  display: 'swap',
});

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-ar',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ziyara Fès — Suivi de Zikr',
  description: 'Application de suivi de zikr pour la ziyara à Fès (19 au 27 décembre 2026)',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0E4D3E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      dir="ltr"
      data-theme="light"
      className={`${fraunces.variable} ${jakarta.variable} ${amiri.variable} ${ibmArabic.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased selection:bg-[var(--accent-primary-soft)]">
        <AppShellProvider>{children}</AppShellProvider>
      </body>
    </html>
  );
}

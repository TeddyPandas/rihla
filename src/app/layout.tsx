import type { Metadata, Viewport } from 'next';
import { Amiri, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { AppShellProvider } from '@/components/providers/app-shell-provider';

const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-display-ar',
  display: 'swap',
});

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
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
  themeColor: '#F4EEE1',
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
      data-palette="A"
      className={`${amiri.variable} ${ibmArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,l=localStorage;var th=l.getItem('ziyara_theme'),p=l.getItem('ziyara_palette'),g=l.getItem('ziyara_lang');if(th==='dark'||th==='light')d.setAttribute('data-theme',th);if(p==='A'||p==='B')d.setAttribute('data-palette',p);if(g==='ar'){d.lang='ar';d.dir='rtl'}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased selection:bg-[var(--accent-primary-soft)]">
        <AppShellProvider>{children}</AppShellProvider>
      </body>
    </html>
  );
}

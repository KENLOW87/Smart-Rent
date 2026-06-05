import type { Metadata, Viewport } from 'next';
import './globals.css';
import InstallPrompt from './InstallPrompt';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://smart-rent-wheat.vercel.app'),
  title: 'Smart Rent',
  description: 'Rental property management for landlords',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Smart Rent',
    description: 'Check your rent and pay online.',
    url: '/',
    siteName: 'Smart Rent',
    type: 'website',
    images: [{ url: '/icons/maskable-512.png', width: 512, height: 512, alt: 'Smart Rent' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Smart Rent',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}

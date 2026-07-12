import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppProviders } from '@/components/app-providers'
import { BRAND_LOGO_URL } from '@/lib/brand'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Bilan Air - Reliable Regional Travel with Somali Pride',
  description: 'Safe, smooth, and dependable air travel across East Africa. Book flights between Nairobi, Mogadishu, and more destinations.',
  keywords: ['airline', 'flights', 'Somalia', 'Kenya', 'East Africa', 'Nairobi', 'Mogadishu', 'booking'],
  generator: 'v0.app',
  icons: {
    icon: [{ url: BRAND_LOGO_URL, type: 'image/jpeg' }],
    shortcut: BRAND_LOGO_URL,
    apple: BRAND_LOGO_URL,
  },
}

export const viewport: Viewport = {
  themeColor: '#1a2744',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground`}
      >
        <AppProviders>{children}</AppProviders>
        {process.env.VERCEL === '1' && <Analytics />}
      </body>
    </html>
  )
}

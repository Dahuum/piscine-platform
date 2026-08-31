import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://42-curriculum-map.example.com'),
  title: {
    default: '42 Curriculum Map',
    template: '%s · 42 Curriculum Map',
  },
  description: 'Explore every 42cursus project — topic, XP value, status, and curriculum path. Find the next thing to build.',
  keywords: ['42 school', '42cursus', 'curriculum', 'projects', 'common core', 'XP'],
  openGraph: {
    title: '42 Curriculum Map',
    description: 'A visual index of projects, skills, and paths through the 42 curriculum.',
    type: 'website',
    siteName: '42 Curriculum Map',
  },
  twitter: {
    card: 'summary',
    title: '42 Curriculum Map',
    description: 'A visual index of projects, skills, and paths through the 42 curriculum.',
  },
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e7e3dc' },
    { media: '(prefers-color-scheme: dark)', color: '#101210' },
  ],
}

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a href="#directory" className="skip-link">Skip to projects</a>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

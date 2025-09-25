import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RadBefund+',
  description: 'Radiologische Befunde optimieren',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SPEAK — AI Speech Coaching',
  description: 'Analyze your voice, match iconic speakers, and transform your delivery.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Little Scientist — Book Your Visit',
  description: 'Children\'s Science Park — Book tickets online',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#08081a' }}>
        {children}
      </body>
    </html>
  )
}

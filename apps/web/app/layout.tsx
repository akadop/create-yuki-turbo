import '@/app/globals.css'

import { Geist } from 'next/font/google'
import { ThemeProvider } from 'next-themes'

import { Toaster } from '@yuki/ui/sonner'
import { cn } from '@yuki/ui/utils'

import { SessionProvider } from '@/hooks/use-session'
import { createMetadata } from '@/lib/metadata'
import { TRPCReactProvider } from '@/lib/trpc/react'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn('min-h-dvh font-sans antialiased', geistSans.variable)}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            <SessionProvider>{children}</SessionProvider>
          </TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

export const metadata = createMetadata({})

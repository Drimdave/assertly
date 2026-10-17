import type { Metadata } from "next"
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google"

import { SyncController } from "@/components/shell/sync-controller"
import { Toaster } from "@/components/ui/sonner"
import { themeInitScript } from "@/lib/theme"
import "./globals.css"

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-sans", display: "swap" })
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Assertly", template: "%s · Assertly" },
  description:
    "A hands-on QA practice platform. Plan, execute and report tests against realistic systems with hidden bugs.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint. Rendered by the server, never from a client component. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${sans.variable} ${mono.variable}`}>
        {children}
        <SyncController />
        <Toaster />
      </body>
    </html>
  )
}

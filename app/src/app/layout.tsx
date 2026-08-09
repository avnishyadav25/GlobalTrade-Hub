'use client';

import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/layout";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { MarketEngine } from "@/components/system/MarketEngine";
import { AgentEngine } from "@/components/system/AgentEngine";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>GlobalTrade Hub — One Screen, All Markets</title>
        <meta
          name="description"
          content="Unified multi-asset trading terminal: crypto, Indian & US equities, forex and commodities. Paper trading, backtesting and an AI trading coach."
        />
      </head>
      <body className={`${hanken.variable} ${plexMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {isAuthPage ? (
            <main className="min-h-screen bg-background text-foreground">{children}</main>
          ) : (
            <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
              <MarketEngine />
              <AgentEngine />
              <TopBar />
              <main className="min-h-0 flex-1 overflow-auto">{children}</main>
            </div>
          )}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              style: {
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

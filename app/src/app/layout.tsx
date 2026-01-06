'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar, TopBar } from "@/components/layout";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  // Check if on auth pages (don't show sidebar/topbar)
  const isAuthPage = pathname?.startsWith('/auth');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>GlobalTrade Hub | One Screen, All Markets</title>
        <meta name="description" content="Unified trading platform for Indian Equities, US Stocks, and Crypto/Commodities." />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {!isAuthPage && (
            <>
              <Sidebar />
              <TopBar />
            </>
          )}
          <main
            className="transition-all duration-200 bg-background text-foreground"
            style={{
              marginLeft: isAuthPage ? 0 : (isMobile ? 0 : '240px'),
              minHeight: '100vh',
              padding: isAuthPage ? 0 : (isMobile ? '16px' : '24px'),
              paddingTop: isAuthPage ? 0 : (isMobile ? '72px' : '88px'),
            }}
          >
            {children}
          </main>
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              style: {
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

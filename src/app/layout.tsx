import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LogoProvider } from "@/contexts/LogoContext";
import { Toaster } from "sonner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "TRT UK Operations Platform",
  description: "Finance, operations and workflow management for TRT World UK",
  openGraph: {
    title: "TRT UK Operations Platform",
    description: "Finance, operations and workflow management for TRT World UK",
  },
  twitter: {
    card: "summary",
    title: "TRT UK Operations Platform",
    description: "Finance, operations and workflow management for TRT World UK",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 antialiased dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>
          <LogoProvider>{children}</LogoProvider>
        </ThemeProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}

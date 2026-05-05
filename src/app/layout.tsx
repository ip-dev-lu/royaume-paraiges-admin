import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Royaume Paraiges - Admin",
  description: "Dashboard d'administration du système de coupons",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
        <Toaster />
        <SonnerToaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}

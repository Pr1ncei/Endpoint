import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prototype Test Chamber",
  description: "First-person movement prototype built with Next.js, React, and Three.js.",
  keywords: ["Next.js", "TypeScript", "Three.js", "first-person", "movement prototype"],
  openGraph: {
    title: "Prototype Test Chamber",
    description: "First-person movement prototype",
    siteName: "Prototype Test Chamber",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prototype Test Chamber",
    description: "First-person movement prototype",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}

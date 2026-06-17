import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const SITE_URL = "https://thenewsnoice.netlify.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "The News Noice: Today's Top 10 India News",
  description:
    "Listen to today's top 10 India news in all 22 constitutional languages. Audio news made simple.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "The News Noice: Today's Top 10 India News",
    description:
      "Listen to today's top 10 India news in all 22 constitutional languages.",
    url: SITE_URL,
    siteName: "The News Noice",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "The News Noice: Today's Top 10 India News",
    description:
      "Listen to today's top 10 India news in all 22 constitutional languages.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}

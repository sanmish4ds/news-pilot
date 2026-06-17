import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "The News Noice: Today's Top 10 India News",
  description:
    "Listen to today's top 10 news from India in all 22 constitutional languages. Made for easy listening.",
  openGraph: {
    title: "The News Noice: Today's Top 10 India News",
    description:
      "Listen to today's top 10 news from India in all 22 constitutional languages.",
    siteName: "The News Noice",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "The News Noice: Today's Top 10 India News",
    description:
      "Listen to today's top 10 news from India in all 22 constitutional languages.",
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

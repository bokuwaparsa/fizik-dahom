import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Toaster } from "@/components/ui/toaster";
import { AppDirection } from "@/components/game/app-direction";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const vazirmatn = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "فیزیک‌دهم — فیزیک دهم را با بازی یاد بگیر",
  description:
    "بازی آموزشی آزاد و رایگان برای فیزیک پایهٔ دهم: ۳۷ درس و آزمایشگاه تعاملی در ۵ فصل، دقیقاً مطابق فهرست کتاب درسی — تمرین گام‌به‌گام، آزمون، امتیاز (XP) و نشان. بدون ثبت‌نام، بدون تبلیغ.",
  keywords: ["فیزیک دهم", "فیزیک", "بازی آموزشی", "آموزش تعاملی", "fizik dahom", "education", "فارسی", "ترمودینامیک", "شناوری"],
  authors: [{ name: "Fizik Dahom contributors" }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} ${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AppDirection>
          {children}
          <Toaster />
        </AppDirection>
      </body>
    </html>
  );
}

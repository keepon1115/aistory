import type { Metadata, Viewport } from "next";
import { Shippori_Mincho } from "next/font/google";
import "./globals.css";

// ビルド時に取得して自前配信するので、当日 Google のサーバーに依存しない
const mincho = Shippori_Mincho({
  weight: "500",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-mincho",
});

export const metadata: Metadata = {
  title: "原稿用紙",
  description: "10文字の言葉から、物語がはじまります。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={mincho.variable}>
      <body>{children}</body>
    </html>
  );
}

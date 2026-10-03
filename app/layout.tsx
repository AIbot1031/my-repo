import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "今天喝什麼｜飲料推薦",
  description: "依偏好、預算與收藏推薦飲料。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}

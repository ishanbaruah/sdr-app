import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Call Practice",
  description: "Practice live sales calls with an AI prospect and get Gong-style feedback",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

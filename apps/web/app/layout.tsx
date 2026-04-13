import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PathwayIQ",
  description: "Career guidance for Australian students",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

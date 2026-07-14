import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Match Horizon",
  description: "A narrow TxLINE-powered World Cup demo scaffold.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

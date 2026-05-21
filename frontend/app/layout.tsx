import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrueNorth",
  description: "A private, evolving profile built from your reflections and files.",
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

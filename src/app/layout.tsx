import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdSpace Audio Autoplay Test",
  description: "Upload a video and test unmuted autoplay via a short link",
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

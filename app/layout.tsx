import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offshore — Workshop Quiz",
  description: "Real-time quiz for the offshore exploration workshop",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Phones hold a fixed layout; letting the answer grid zoom just makes it
  // harder to hit the buttons one-handed.
  maximumScale: 1,
  themeColor: "#04070f",
  // Lets the phone view paint into the notch/home-indicator area; the play
  // page pads itself back out with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-display">{children}</body>
    </html>
  );
}

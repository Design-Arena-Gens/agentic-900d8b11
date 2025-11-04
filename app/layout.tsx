import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KaleidoScope Audio Visualizer",
  description: "Hypnotic kaleidoscope audio visualizer with fine-tuned controls"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

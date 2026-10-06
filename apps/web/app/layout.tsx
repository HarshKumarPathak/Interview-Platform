import type { Metadata } from "next";
import "./globals.css";
import "./product.css";

export const metadata: Metadata = {
  title: "Interview Platform — Realistic AI Interviews",
  description:
    "Practice realistic, adaptive interviews with AI across placements, competitive exams, college interviews, and professional hiring.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

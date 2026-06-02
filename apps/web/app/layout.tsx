import type { Metadata } from "next";
import { Open_Sans, Inter } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-serif", // mapped to headings
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans", // mapped to body
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quorum | Concordia Capstone Matching Platform",
  description: "Academic SaaS collaboration hub for Concordia Capstone projects, student teams, and claims management.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${openSans.variable} ${inter.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
import { AppShell } from "@/components/app-shell";

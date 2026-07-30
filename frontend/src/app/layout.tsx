import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "CodeSageZ",
  description: "Graph-augmented code intelligence. Ask questions about any Python codebase.",
};

const NAV = [
  { href: "/repos",        label: "Repos"       },
  { href: "/playground",   label: "Playground"  },
  { href: "/benchmarks",   label: "Benchmarks"  },
  { href: "/architecture", label: "Architecture" },
];

import { Inter, Space_Grotesk, JetBrains_Mono, Playfair_Display } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", style: ['normal', 'italic'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${playfair.variable} font-sans antialiased text-[#F0F4FF] relative overflow-x-hidden`} style={{ background: 'var(--cs-bg)' }}>
        <div className="cs-noise" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Nav />
          <main id="main-content" role="main" className="flex-1 flex flex-col pt-16">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

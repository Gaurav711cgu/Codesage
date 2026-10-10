import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "CodeSageZ — Enterprise Graph-RAG Engine",
  description: "AST-aware code intelligence and Graph-RAG inference engine. Sub-50ms vector retrieval with SingleFlight request coalescing.",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased text-foreground relative overflow-x-hidden`} style={{ background: 'hsl(var(--background))' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Nav />
          <main id="main-content" role="main" className="flex-1 flex flex-col pt-14">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

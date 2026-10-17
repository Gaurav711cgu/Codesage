import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "CodeSage — Repository intelligence",
  description: "Explore repository source, inspect definitions, and follow call relationships in one workspace.",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased text-foreground relative" style={{ background: 'hsl(var(--background))' }}>
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

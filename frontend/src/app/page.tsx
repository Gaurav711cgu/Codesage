import React from 'react';
import dynamic from 'next/dynamic';
import AnimatedHero from '@/components/AnimatedHero';

// Dynamically import ThreeBackground to avoid SSR issues with WebGL
const ThreeBackground = dynamic(() => import('@/components/ThreeBackground'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="relative min-h-screen bg-black overflow-hidden flex flex-col">
      <ThreeBackground />
      
      {/* Navbar Overlay */}
      <nav className="relative z-10 flex items-center justify-between p-6 md:px-12 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="text-white font-bold text-xl tracking-tight flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
            <span className="text-black text-xs font-black">CS</span>
          </div>
          CodeSage
        </div>
        <div className="flex gap-6 text-sm text-gray-400 font-medium">
          <a href="/repos" className="hover:text-white transition-colors">Repositories</a>
          <a href="/playground" className="hover:text-white transition-colors">Playground</a>
          <a href="/benchmarks" className="hover:text-white transition-colors">Benchmarks</a>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <AnimatedHero />
      </div>

      {/* Footer Overlay */}
      <footer className="relative z-10 p-6 text-center text-xs text-gray-600">
        &copy; {new Date().getFullYear()} CodeSage AI. Built with Next.js, Three.js, and Anime.js.
      </footer>
    </main>
  );
}

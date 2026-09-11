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
      


      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <AnimatedHero />
      </div>


    </main>
  );
}

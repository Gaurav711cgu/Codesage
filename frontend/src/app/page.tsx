import React from 'react';
import dynamic from 'next/dynamic';
import AnimatedHero from '@/components/AnimatedHero';
import BentoFeatures from '@/components/BentoFeatures';

// Dynamically import ThreeBackground to avoid SSR issues with WebGL
const ThreeBackground = dynamic(() => import('@/components/ThreeBackground'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="relative min-h-screen bg-black overflow-hidden flex flex-col">
      <ThreeBackground />
      
      {/* Hero Content */}
      <div className="flex-1 flex flex-col items-center justify-start pt-[15vh] relative z-10 w-full">
        <AnimatedHero />
        
        {/* The new features grid filling out the lower half */}
        <BentoFeatures />
      </div>
    </main>
  );
}

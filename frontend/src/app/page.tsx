import React from 'react';
import dynamic from 'next/dynamic';
import AnimatedHero from '@/components/AnimatedHero';
import BentoFeatures from '@/components/BentoFeatures';
import { SystemSimulation } from '@/components/SystemSimulation';

// Dynamically import ThreeBackground to avoid SSR issues with WebGL
const ThreeBackground = dynamic(() => import('@/components/ThreeBackground'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="relative min-h-screen bg-background overflow-x-hidden flex flex-col font-sans">
      <ThreeBackground />
      
      {/* Hero Content */}
      <div className="flex-1 flex flex-col items-center justify-start pt-[15vh] relative z-10 w-full px-6">
        <AnimatedHero />
        
        {/* Terminal Simulation */}
        <div className="w-full mt-12 mb-24 max-w-5xl">
          <SystemSimulation />
        </div>

        {/* The new features grid filling out the lower half */}
        <BentoFeatures />
      </div>
    </main>
  );
}

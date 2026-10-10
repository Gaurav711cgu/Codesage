import React from 'react';
import AnimatedHero from '@/components/AnimatedHero';
import BentoFeatures from '@/components/BentoFeatures';
import { SystemSimulation } from '@/components/SystemSimulation';

export default function Home() {
  return (
    <main className="relative min-h-screen bg-background overflow-x-hidden flex flex-col font-sans">
      <div className="flex-1 flex flex-col items-center justify-start pt-10 pb-20 relative z-10 w-full px-4 sm:px-6">
        <AnimatedHero />
        
        {/* Terminal Simulation */}
        <div className="w-full my-12 max-w-5xl">
          <SystemSimulation />
        </div>

        {/* Subsystems Architecture Matrix */}
        <BentoFeatures />
      </div>
    </main>
  );
}

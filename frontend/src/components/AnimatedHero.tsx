"use client";

import React, { useEffect, useRef } from 'react';
import anime from 'animejs';

export default function AnimatedHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Advanced Anime.js Timeline Orchestration
    const tl = anime.timeline({
      easing: "spring(1, 80, 10, 0)",
    });

    // Animate the spans inside the title
    tl.add({
      targets: ".hero-title .char",
      translateY: [50, 0],
      opacity: [0, 1],
      delay: anime.stagger(30),
      duration: 1200
    })
    .add({
      targets: ".hero-subtitle",
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 1000
    }, "-=800")
    .add({
      targets: ".hero-action",
      scale: [0.9, 1],
      opacity: [0, 1],
      duration: 800,
      delay: anime.stagger(150)
    }, "-=600");
  }, []);

  // Split text into spans for staggered animation
  const titleText = "CodeSage.";
  
  return (
    <div ref={containerRef} className="relative z-10 flex flex-col items-center justify-center min-h-[50vh] pb-16 text-center px-4 pointer-events-auto w-full">
      <h1 className="hero-title text-6xl md:text-8xl font-extrabold tracking-tighter text-white mb-6">
        {titleText.split('').map((char, i) => (
          <span key={i} className="char inline-block opacity-0 translate-y-12 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            {char}
          </span>
        ))}
      </h1>
      
      <p className="hero-subtitle opacity-0 max-w-2xl text-xl text-gray-400 mb-10 font-light">
        The ultimate AI developer platform. Intelligent semantic search, distributed caching, and zero-trust security built in.
      </p>

      <div className="flex gap-4">
        <a href="/repos" className="hero-action opacity-0 px-8 py-4 bg-white text-black font-semibold rounded-full hover:scale-105 transition-transform pointer-events-auto">
          Connect Repository
        </a>
        <a href="/playground" className="hero-action opacity-0 px-8 py-4 bg-zinc-900 border border-zinc-800 text-white font-semibold rounded-full hover:bg-zinc-800 transition-colors pointer-events-auto">
          Try Playground
        </a>
      </div>
    </div>
  );
}

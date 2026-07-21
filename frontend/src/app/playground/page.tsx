"use client";

import React, { useState, useRef, useEffect } from 'react';
import RevealSection from '@/components/RevealSection';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { Terminal, Code, ArrowRight } from 'lucide-react';

export default function PlaygroundPage() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([
    { type: 'system', content: 'CodeSage v1.0.0 (Llama-3.3-8B-Instruct fine-tuned)' },
    { type: 'system', content: 'Type a prompt or code snippet to test completion. e.g. "Write a binary search in Python"' }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userQuery = input.trim();
    setHistory(prev => [...prev, { type: 'user', content: '> ' + userQuery }]);
    setInput('');
    setIsGenerating(true);

    // Simulate API delay and streaming response
    setTimeout(() => {
      setHistory(prev => [...prev, { 
        type: 'assistant', 
        content: `def binary_search(arr, target):\\n    left, right = 0, len(arr) - 1\\n    \\n    while left <= right:\\n        mid = (left + right) // 2\\n        if arr[mid] == target:\\n            return mid\\n        elif arr[mid] < target:\\n            left = mid + 1\\n        else:\\n            right = mid - 1\\n            \\n    return -1\\n\\n# Time Complexity: O(log n)\\n# Space Complexity: O(1)`
      }]);
      setIsGenerating(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center p-4 sm:p-8">
      <Nav />
      
      <main className="flex-1 w-full max-w-4xl mt-24 mb-16 space-y-8 flex flex-col">
        <RevealSection className="space-y-4 text-center shrink-0">
          <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold mb-2">
            Interactive
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Live Playground
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            Test the CodeSage model directly in your browser.
          </p>
        </RevealSection>

        <RevealSection delay={200} className="flex-1 min-h-[500px] max-h-[700px] border border-white/20 rounded-xl bg-[#0a0a0a] flex flex-col overflow-hidden shadow-2xl shadow-green-900/20">
          {/* Terminal Header */}
          <div className="h-12 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2 shrink-0">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <div className="ml-4 flex items-center text-xs text-gray-400 font-sans gap-2 font-semibold">
              <Terminal size={14} />
              <span>codesage@modal-a10g:~$</span>
            </div>
          </div>

          {/* Terminal Output */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 text-sm font-mono leading-relaxed">
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.type === 'user' ? 'text-blue-400' : msg.type === 'system' ? 'text-gray-500' : 'text-green-400'}`}>
                {msg.type === 'assistant' ? (
                  <pre className="whitespace-pre-wrap">{msg.content}</pre>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            ))}
            {isGenerating && (
              <div className="text-green-400 animate-pulse">
                <span className="inline-block w-2 h-4 bg-green-400"></span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Terminal Input */}
          <form onSubmit={handleSubmit} className="shrink-0 p-4 bg-white/5 border-t border-white/10 flex items-center gap-3">
            <Code size={18} className="text-gray-500 shrink-0" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask CodeSage to write some code..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-gray-600 font-mono"
              disabled={isGenerating}
              autoComplete="off"
            />
            <button 
              type="submit" 
              disabled={isGenerating || !input.trim()}
              className="p-2 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 transition-colors"
            >
              <ArrowRight size={18} />
            </button>
          </form>
        </RevealSection>
      </main>
      
      <Footer />
    </div>
  );
}

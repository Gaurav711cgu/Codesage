import React from 'react';
import { FAILURE_MODES } from '@/constants/content';
import RevealSection from '@/components/RevealSection';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

const severityMap: Record<string, { color: string, icon: React.ReactNode }> = {
  high: { color: 'text-red-400 border-red-500/30 bg-red-500/10', icon: <ShieldAlert size={20} /> },
  medium: { color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', icon: <AlertTriangle size={20} /> },
  low: { color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', icon: <Info size={20} /> },
};

export default function FailuresPage() {
  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center p-4 sm:p-8">
      <Nav />
      
      <main className="flex-1 w-full max-w-4xl mt-24 mb-16 space-y-12">
        <RevealSection className="space-y-6">
          <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-sm font-semibold mb-4">
            Phase 3: Post-Mortems
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Failure Modes &amp; Fixes
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
            Building LLM systems is messy. This is a transparent log of what went wrong during training and deployment, and the engineering required to fix it.
          </p>
        </RevealSection>

        <div className="space-y-8 mt-16">
          {FAILURE_MODES.map((failure, idx) => {
            const sev = severityMap[failure.severity] || severityMap.low;
            return (
              <RevealSection key={idx} delay={idx * 100} className="rounded-xl border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col">
                <div className="border-b border-white/10 bg-white/5 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-3">
                    <span className={`${sev.color.split(' ')[0]}`}>{sev.icon}</span>
                    {failure.title}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-bold uppercase rounded border ${sev.color}`}>
                    {failure.severity} SEVERITY
                  </span>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wider">The Problem</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{failure.problem}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Root Cause</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{failure.rootCause}</p>
                    </div>
                  </div>
                  
                  <div className="border-t border-white/10 pt-6">
                    <h4 className="text-green-400 text-xs font-bold uppercase tracking-wider mb-3">The Fix</h4>
                    <div className="bg-green-500/5 border border-green-500/20 rounded p-4 text-green-400 text-sm leading-relaxed">
                      {failure.fix}
                    </div>
                  </div>
                  
                  <div className="bg-black/50 rounded p-4 text-gray-400 text-xs flex items-start gap-2 border border-white/5">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <span><strong className="text-gray-300">Residual Risk:</strong> {failure.risk}</span>
                  </div>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

import React from 'react';
import { INFERENCE_COMPONENTS } from '@/constants/content';
import RevealSection from '@/components/RevealSection';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { Server, Cpu, Database, Zap, Activity } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  router: <Server size={24} color="currentColor" />,
  scheduler: <Activity size={24} color="currentColor" />,
  paged: <Database size={24} color="currentColor" />,
  workers: <Cpu size={24} color="currentColor" />,
  streaming: <Zap size={24} color="currentColor" />,
};

const colorMap: Record<string, string> = {
  amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  green: 'text-green-400 border-green-500/30 bg-green-500/10',
};

export default function InferencePage() {
  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center p-4 sm:p-8">
      <Nav />
      
      <main className="flex-1 w-full max-w-5xl mt-24 mb-16 space-y-12">
        <RevealSection className="space-y-6 text-center">
          <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold mb-4">
            Phase 2: High-Performance Serving
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Inference Architecture
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            Deep dive into the vLLM serving infrastructure that enables 12,500 tokens/second throughput and 24x the performance of naive HuggingFace pipelines.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {INFERENCE_COMPONENTS.map((comp, idx) => {
            const colorClass = colorMap[comp.color] || colorMap.green;
            return (
              <RevealSection 
                key={comp.id} 
                delay={idx * 150} 
                className={`p-6 rounded-xl border bg-black/50 backdrop-blur-sm transition-all hover:-translate-y-1 ${colorClass.replace('text-', 'hover:border-').split(' ')[0]}`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 border ${colorClass}`}>
                  {iconMap[comp.id] || <Server size={24} />}
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">{comp.title}</h3>
                
                <div className={`inline-block px-2 py-1 mb-4 text-xs font-semibold rounded border ${colorClass}`}>
                  {comp.summary}
                </div>
                
                <p className="text-gray-400 text-sm leading-relaxed">
                  {comp.details}
                </p>
              </RevealSection>
            );
          })}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

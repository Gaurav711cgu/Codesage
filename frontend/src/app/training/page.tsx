import React from 'react';
import { TRAINING_STAGES } from '@/constants/content';
import RevealSection from '@/components/RevealSection';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { Database, Sliders, LineChart, GitMerge, Cloud } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  database: <Database size={24} color="currentColor" />,
  sliders: <Sliders size={24} color="currentColor" />,
  chart: <LineChart size={24} color="currentColor" />,
  merge: <GitMerge size={24} color="currentColor" />,
  cloud: <Cloud size={24} color="currentColor" />,
};

export default function TrainingPage() {
  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center p-4 sm:p-8">
      <Nav />
      
      <main className="flex-1 w-full max-w-4xl mt-24 mb-16 space-y-12">
        <RevealSection className="space-y-6">
          <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold mb-4">
            Phase 1: Knowledge Acquisition
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Training &amp; Fine-Tuning
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
            A comprehensive look at the end-to-end pipeline for turning a base Llama 3.3 8B model into a highly-specialized code completion engine.
          </p>
        </RevealSection>

        <div className="space-y-16 mt-16 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-green-500/20 before:to-transparent">
          {TRAINING_STAGES.map((stage, idx) => (
            <RevealSection key={idx} delay={idx * 100} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              {/* Timeline dot */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-black bg-green-500/20 text-green-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 absolute left-0 md:left-1/2 transform -translate-x-1/2">
                {iconMap[stage.icon] || <Database size={16} />}
              </div>

              {/* Content Card */}
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] ml-auto md:ml-0 p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-green-500/30 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-white">{stage.title}</h3>
                </div>
                
                <div className="mb-4 inline-block px-2 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded">
                  {stage.badge}
                </div>
                
                <p className="text-gray-400 text-sm mb-6">{stage.summary}</p>
                
                <div className="space-y-4 text-sm text-gray-300">
                  {Object.entries(stage.content).map(([key, value], i) => (
                    <div key={i} className="border-t border-white/10 pt-3">
                      <h4 className="text-green-400 capitalize mb-2">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                      {Array.isArray(value) ? (
                        <ul className="list-disc list-inside space-y-1">
                          {value.map((item, j) => (
                            <li key={j} className="text-gray-400 leading-relaxed">
                              {typeof item === 'string' ? item : (
                                <span><strong className="text-white">{item.name || item.config}</strong> - {item.details || item.status}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : typeof value === 'object' && value !== null ? (
                        <div className="grid grid-cols-1 gap-1">
                          {Object.entries(value).map(([k, v], j) => (
                            <div key={j} className="flex gap-2">
                              <span className="text-gray-500">{k}:</span>
                              <span className="text-gray-300">{v as string}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400">{String(value)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </RevealSection>
          ))}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

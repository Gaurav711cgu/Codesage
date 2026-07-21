import React from 'react';
import { COMPANY_CARDS } from '@/constants/content';
import RevealSection from '@/components/RevealSection';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { Briefcase, Building, MessageSquare } from 'lucide-react';

const colorMap: Record<string, string> = {
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  green: 'text-green-400 bg-green-500/10 border-green-500/30',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

export default function StoriesPage() {
  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center p-4 sm:p-8">
      <Nav />
      
      <main className="flex-1 w-full max-w-4xl mt-24 mb-16 space-y-12">
        <RevealSection className="space-y-6 text-center">
          <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold mb-4">
            Phase 6: The Pitch
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Interview Stories
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            How to translate the deep technical work in this repository into compelling narratives for top AI research labs.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {COMPANY_CARDS.map((card, idx) => {
            const colorClass = colorMap[card.color] || colorMap.green;
            return (
              <RevealSection key={idx} delay={idx * 150} className={`p-6 rounded-xl border bg-[#0a0a0a] transition-all flex flex-col h-full ${colorClass.replace('bg-', 'hover:bg-opacity-20 ')}`}>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 border ${colorClass}`}>
                  <Building size={24} />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-6">{card.company}</h3>
                
                <div className="space-y-4 flex-1">
                  {card.content.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-gray-400 text-sm leading-relaxed">
                      {paragraph.includes("What they'll ask:") || paragraph.includes("They'll ask:") ? (
                        <>
                          <span className="block text-white font-bold mb-1">
                            <MessageSquare size={14} className="inline mr-2 text-gray-500" />
                            {paragraph.split('\n')[0]}
                          </span>
                          <span className="block pl-5 border-l-2 border-green-500/30">
                            {paragraph.split('\n')[1]}
                          </span>
                        </>
                      ) : paragraph.includes('Connect:') || paragraph.includes('Lead with:') ? (
                        <>
                          <strong className="text-white block mb-1">
                            <Briefcase size={14} className="inline mr-2 text-gray-500" />
                            Strategy:
                          </strong>
                          {paragraph}
                        </>
                      ) : (
                        paragraph
                      )}
                    </p>
                  ))}
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

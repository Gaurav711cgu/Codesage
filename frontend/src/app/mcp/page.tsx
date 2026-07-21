import React from 'react';
import { MCP_TOOLS } from '@/constants/content';
import RevealSection from '@/components/RevealSection';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { Code2, Search, FlaskConical, BookOpen, Terminal } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  code: <Code2 size={24} color="currentColor" />,
  search: <Search size={24} color="currentColor" />,
  flask: <FlaskConical size={24} color="currentColor" />,
  book: <BookOpen size={24} color="currentColor" />,
};

const colorMap: Record<string, string> = {
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  green: 'text-green-400 bg-green-500/10 border-green-500/30',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

export default function MCPPage() {
  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center p-4 sm:p-8">
      <Nav />
      
      <main className="flex-1 w-full max-w-4xl mt-24 mb-16 space-y-12">
        <RevealSection className="space-y-6">
          <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold mb-4">
            Phase 4: Tool Integration
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            MCP Server API
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
            CodeSage is exposed as a standard Model Context Protocol (MCP) server. This allows seamless integration with Claude Desktop, Cursor, and custom LangGraph agents.
          </p>
        </RevealSection>

        <div className="space-y-12 mt-16">
          {MCP_TOOLS.map((tool, idx) => {
            const badgeClass = colorMap[tool.badgeColor] || colorMap.blue;
            return (
              <RevealSection key={idx} delay={idx * 100} className="border border-white/10 bg-white/5 rounded-xl overflow-hidden">
                <div className="border-b border-white/10 bg-black/40 px-6 py-5 flex items-center gap-4">
                  <div className={`p-2 rounded-lg border ${badgeClass.replace('bg-', 'bg-opacity-20 ')}`}>
                    {iconMap[tool.icon] || <Terminal size={24} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white font-sans">{tool.name}</h3>
                    <div className="flex gap-2 mt-2">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${badgeClass}`}>
                        {tool.badge}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  <div>
                    <h4 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-3">Parameters</h4>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4 font-mono text-sm space-y-2">
                      {tool.params.map((param, i) => {
                        const [name, type] = param.split(': ');
                        return (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                            <span className="text-green-400 font-bold">{name}:</span>
                            <span className="text-gray-400">{type}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-3">Returns</h4>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4 font-mono text-sm text-blue-300">
                      {tool.returns}
                    </div>
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

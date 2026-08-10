import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8" style={{ borderTop: '1px solid var(--cs-border)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <Link to="/" className="font-head font-bold text-lg mb-1 inline-block" style={{ color: 'var(--cs-text)' }}>
            CodeSage — Fine-Tuned Code Intelligence
          </Link>
          <div className="text-xs" style={{ color: 'var(--cs-text3)' }}>
            Built on Llama 3.3 8B + QLoRA + vLLM + Modal + MCP
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <a href="https://github.com/Gaurav711cgu" target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-md transition-colors duration-150"
            style={{ background: 'var(--cs-surface)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
            GitHub
          </a>
          <a href="#" className="text-xs px-3 py-1.5 rounded-md transition-colors duration-150"
            style={{ background: 'var(--cs-surface)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
            HuggingFace Model
          </a>
          <a href="#" className="text-xs px-3 py-1.5 rounded-md transition-colors duration-150"
            style={{ background: 'var(--cs-surface)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
            MCP Server
          </a>
          <a href="#" className="text-xs px-3 py-1.5 rounded-md transition-colors duration-150"
            style={{ background: 'var(--cs-surface)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
            W&B Dashboard
          </a>
        </div>

        {/* Quick nav */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {[
            { to: '/playground', label: 'Playground' },
            { to: '/training', label: 'Training' },
            { to: '/benchmarks', label: 'Benchmarks' },
            { to: '/inference', label: 'Inference' },
            { to: '/failures', label: 'Failures' },
            { to: '/mcp', label: 'MCP' },
            { to: '/stack', label: 'Stack' },
            { to: '/resume', label: 'Resume' },
          ].map(link => (
            <Link key={link.to} to={link.to} className="text-xs transition-colors duration-150"
              style={{ color: 'var(--cs-text3)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--cs-text2)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--cs-text3)'}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="text-center mb-6">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--cs-text3)', maxWidth: 560, margin: '0 auto' }}>
            Benchmark data: HumanEval (Chen et al., 2021), MBPP (Austin et al., 2021),
            EvalPlus (Liu et al., 2023). vLLM benchmarks: UC Berkeley / Morph, 2025.
            QLoRA: Dettmers et al., 2023. DoRA: Liu et al., 2024.
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs italic" style={{ color: 'var(--cs-text3)' }}>
            "The failure analysis section was written after training, not before.
            Real systems fail in specific ways. This one does too."
          </p>
        </div>
      </div>
    </footer>
  );
}

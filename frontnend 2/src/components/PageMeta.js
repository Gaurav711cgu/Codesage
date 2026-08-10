import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_META = {
  '/': {
    title: 'CodeSage — Fine-Tuned Code Intelligence | Llama 3.3 8B',
    description: 'QLoRA fine-tuned Llama 3.3 8B code model. +7.1pp HumanEval over base. vLLM serving at 12,500 tok/s. MCP server for Claude Desktop and Cursor. Built for $9.40.'
  },
  '/playground': {
    title: 'Live Playground — CodeSage',
    description: 'Try CodeSage in action: code completion, review, test generation, and documentation. Powered by Google Gemini 2.0 Flash simulating production outputs.'
  },
  '/training': {
    title: 'Training Pipeline — CodeSage',
    description: 'Complete training methodology: dataset curation, QLoRA fine-tuning with r=16, DPO preference learning, evaluation harness, and deployment monitoring.'
  },
  '/benchmarks': {
    title: 'Benchmark Results — CodeSage',
    description: 'HumanEval, MBPP, SWE-bench results. Detailed performance analysis showing +7.1pp improvement over base Llama 3.3 8B on code completion tasks.'
  },
  '/inference': {
    title: 'Inference Architecture — CodeSage',
    description: 'vLLM serving architecture: 12,500 tok/s throughput, KV cache optimization, PagedAttention, and speculative decoding for production deployment.'
  },
  '/failures': {
    title: 'Failure Analysis — CodeSage',
    description: 'Honest failure mode analysis: edge cases, hallucination patterns, context limitations, and mitigation strategies for production deployment.'
  },
  '/mcp': {
    title: 'MCP Integration — CodeSage',
    description: 'Model Context Protocol integration: CodeSage as an MCP server for Claude Desktop, Cursor, and other AI assistants. Complete API documentation.'
  },
  '/stack': {
    title: 'Tech Stack — CodeSage',
    description: 'Technology choices: PyTorch, QLoRA/PEFT, vLLM, Weights & Biases, FastAPI, React. Architecture decisions and trade-offs explained.'
  },
  '/resume': {
    title: 'Resume Integration — CodeSage',
    description: 'Ready-to-use resume bullet points and talking points for showcasing CodeSage in job applications and technical interviews.'
  }
};

export const PageMeta = () => {
  const location = useLocation();

  useEffect(() => {
    const meta = PAGE_META[location.pathname] || PAGE_META['/'];
    
    // Update title
    document.title = meta.title;
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = meta.description;

    // Update OG tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = meta.title;

    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.content = meta.description;
  }, [location.pathname]);

  return null;
};

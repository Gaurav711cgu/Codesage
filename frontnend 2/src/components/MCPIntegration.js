import React from 'react';
import { MCP_TOOLS } from '../constants/content';
import { Code, Search, FlaskConical, BookOpen } from 'lucide-react';

const ICONS = {
  code: Code,
  search: Search,
  flask: FlaskConical,
  book: BookOpen,
};

const BADGE_COLORS = {
  blue: { bg: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: 'rgba(59,130,246,0.25)' },
  amber: { bg: 'rgba(245,158,11,0.12)', color: 'var(--cs-amber)', border: 'rgba(245,158,11,0.25)' },
  green: { bg: 'rgba(34,197,94,0.12)', color: 'var(--cs-green)', border: 'rgba(34,197,94,0.25)' },
  purple: { bg: 'rgba(168,85,247,0.12)', color: 'var(--cs-purple-l)', border: 'rgba(168,85,247,0.25)' },
};

const MCP_CODE = `from mcp.server.fastmcp import FastMCP
import httpx

mcp = FastMCP("codesage")
VLLM_BASE = "https://your-modal-endpoint.modal.run"

@mcp.tool()
async def complete_code(
    code: str,
    language: str = "python",
    context: str = "",
    max_tokens: int = 512
) -> dict:
    """Complete partial code using CodeSage."""
    prompt = build_completion_prompt(code, language, context)
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{VLLM_BASE}/v1/completions",
            json={
                "model": "codesage-v1",
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": 0.1,
            },
            timeout=30.0
        )
    result = response.json()
    return {
        "completion": result["choices"][0]["text"],
        "tokens_used": result["usage"]["completion_tokens"]
    }

if __name__ == "__main__":
    mcp.run()  # stdio for Claude Desktop`;

const INSTALL_CONFIG = `// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "codesage": {
      "command": "uvx",
      "args": ["codesage-mcp"],
      "env": {
        "CODESAGE_API_KEY": "your-key-here"
      }
    }
  }
}`;

export default function MCPIntegration({ embedded }) {
  return (
    <section id="mcp" data-testid="mcp-integration-section" className={embedded ? "pb-16 px-4 sm:px-6 lg:px-8" : "py-16 sm:py-20 px-4 sm:px-6 lg:px-8"}
      aria-label="MCP Integration">
      <div className="max-w-6xl mx-auto">
        {!embedded && (
        <div className="text-center mb-10">
          <span className="text-xs font-medium px-3 py-1 rounded-full mb-3 inline-block"
            style={{ background: 'rgba(168,85,247,0.12)', color: 'var(--cs-purple-l)', border: '1px solid rgba(168,85,247,0.25)' }}>
            MCP Integration
          </span>
          <h2 className="font-head font-semibold text-3xl sm:text-4xl mt-3" style={{ color: 'var(--cs-text)' }}>
            CodeSage as a Universal Tool
          </h2>
          <p className="mt-3" style={{ color: 'var(--cs-text2)', maxWidth: 560, margin: '12px auto 0' }}>
            Model Context Protocol (MCP) — introduced by Anthropic Nov 2024, 97M monthly SDK downloads.
            CodeSage exposes 4 tools any agent or IDE can call.
          </p>
        </div>
        )}

        {/* Architecture diagram */}
        <div className="rounded-xl p-6 mb-8" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
          <div className="font-mono text-xs sm:text-sm overflow-x-auto" style={{ color: 'var(--cs-text2)', lineHeight: '1.8' }}>
            <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--cs-code-bg)', border: '1px solid var(--cs-border)' }}>
              <div style={{ color: 'var(--cs-text3)' }}>{'                    MCP CLIENTS'}</div>
              <div style={{ color: 'var(--cs-text2)' }}>{'  Claude Desktop | Cursor IDE | GitHub Copilot'}</div>
              <div style={{ color: 'var(--cs-text3)' }}>{'  Any LangGraph agent | VS Code (MCP extension)'}</div>
              <div className="my-2" style={{ color: 'var(--cs-text3)' }}>{'              │ MCP Protocol (JSON-RPC 2.0)'}</div>
              <div style={{ color: 'var(--cs-purple-l)' }}>{'          CODESAGE MCP SERVER'}</div>
              <div style={{ color: 'var(--cs-text2)' }}>{'  (FastAPI + mcp Python SDK)'}</div>
              <div style={{ color: 'var(--cs-blue-l)' }}>{'  Tool 1: complete_code(code, language, context)'}</div>
              <div style={{ color: 'var(--cs-amber)' }}>{'  Tool 2: review_code(code, focus_area)'}</div>
              <div style={{ color: 'var(--cs-green)' }}>{'  Tool 3: generate_tests(code, framework)'}</div>
              <div style={{ color: 'var(--cs-purple-l)' }}>{'  Tool 4: explain_code(code, audience)'}</div>
              <div className="my-2" style={{ color: 'var(--cs-text3)' }}>{'              │ HTTP / OpenAI-compatible API'}</div>
              <div style={{ color: 'var(--cs-blue)' }}>{'          vLLM INFERENCE SERVER'}</div>
              <div style={{ color: 'var(--cs-text3)' }}>{'  CodeSage-Llama-3.3-8B-v1 (merged weights)'}</div>
              <div style={{ color: 'var(--cs-orange)' }}>{'  Modal A10G GPU | PagedAttention'}</div>
            </div>
          </div>
        </div>

        {/* Tool cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {MCP_TOOLS.map((tool, i) => {
            const Icon = ICONS[tool.icon] || Code;
            const bc = BADGE_COLORS[tool.badgeColor] || BADGE_COLORS.blue;
            return (
              <div key={i} data-testid={`mcp-tool-card-${i}`}
                className="rounded-xl p-5 transition-colors duration-200 hover:translate-y-[-2px]"
                style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={16} style={{ color: bc.color }} />
                  <span className="font-mono text-sm font-semibold" style={{ color: 'var(--cs-text)' }}>{tool.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: bc.bg, color: bc.color, border: `1px solid ${bc.border}` }}>
                    {tool.badge}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  <div className="text-xs font-medium" style={{ color: 'var(--cs-text3)' }}>Parameters:</div>
                  {tool.params.map((p, j) => (
                    <div key={j} className="font-mono text-xs" style={{ color: 'var(--cs-text2)' }}>{p}</div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--cs-text3)' }}>Returns:</div>
                  <div className="font-mono text-xs" style={{ color: 'var(--cs-green-l)' }}>{tool.returns}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Code blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--cs-code-bg)', border: '1px solid var(--cs-border)' }}>
            <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--cs-border)' }}>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }}></div>
                <div className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }}></div>
                <div className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }}></div>
              </div>
              <span className="font-mono text-xs" style={{ color: 'var(--cs-text3)' }}>mcp_server.py</span>
            </div>
            <pre className="p-4 font-mono text-xs overflow-x-auto" style={{ color: 'var(--cs-text2)', lineHeight: '1.6' }}>
              {MCP_CODE}
            </pre>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--cs-code-bg)', border: '1px solid var(--cs-border)' }}>
            <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--cs-border)' }}>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }}></div>
                <div className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }}></div>
                <div className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }}></div>
              </div>
              <span className="font-mono text-xs" style={{ color: 'var(--cs-text3)' }}>claude_desktop_config.json</span>
            </div>
            <pre className="p-4 font-mono text-xs overflow-x-auto" style={{ color: 'var(--cs-text2)', lineHeight: '1.6' }}>
              {INSTALL_CONFIG}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

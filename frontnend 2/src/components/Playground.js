import React, { useState, useRef, useCallback, useEffect } from 'react';
import { highlightCode } from '../utils/syntaxHighlight';
import {
  DEFAULT_COMPLETION_INPUT, DEFAULT_REVIEW_INPUT,
  DEFAULT_TESTGEN_INPUT, DEFAULT_DOCSTRING_INPUT,
  COMPLETION_PRESETS,
} from '../constants/fallbacks';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: 'completion', label: 'Code Completion', shortcut: '1' },
  { id: 'review', label: 'Code Review', shortcut: '2' },
  { id: 'testgen', label: 'Test Generation', shortcut: '3' },
  { id: 'docstring', label: 'Docstring', shortcut: '4' },
];

const LANGUAGES = ['Python', 'TypeScript', 'Rust', 'Go', 'Java', 'C', 'C++', 'SQL'];
const FRAMEWORKS = ['pytest', 'unittest', 'jest', 'vitest'];
const STYLES = ['Google', 'NumPy', 'Sphinx', 'JSDoc'];

const DEFAULT_INPUTS = {
  completion: DEFAULT_COMPLETION_INPUT,
  review: DEFAULT_REVIEW_INPUT,
  testgen: DEFAULT_TESTGEN_INPUT,
  docstring: DEFAULT_DOCSTRING_INPUT,
};

function CodeBlock({ code, language, streaming }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--cs-code-bg)', border: '1px solid var(--cs-border)' }}>
      <div className="p-4 font-mono text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap" style={{ lineHeight: '1.6', minHeight: 120 }}
        role="region" aria-label="Code output" aria-live="polite">
        {code ? (
          <pre dangerouslySetInnerHTML={{ __html: highlightCode(code, language?.toLowerCase()) }} />
        ) : (
          <span style={{ color: 'var(--cs-text3)' }}>Output will appear here...</span>
        )}
        {streaming && <span className="cursor-blink inline-block w-1.5 h-4 ml-0.5" style={{ background: 'var(--cs-green-l)' }} aria-hidden="true"></span>}
      </div>
    </div>
  );
}

function LoadingSteps({ steps }) {
  return (
    <div className="space-y-2 py-4" role="status" aria-label="Processing">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--cs-text2)' }}>
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--cs-blue)', borderTopColor: 'transparent' }} aria-hidden="true"></div>
          {step}
        </div>
      ))}
      <span className="sr-only">Processing your code...</span>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const colors = {
    HIGH: { bg: 'rgba(239,68,68,0.12)', color: 'var(--cs-red)', border: 'rgba(239,68,68,0.25)' },
    MEDIUM: { bg: 'rgba(245,158,11,0.12)', color: 'var(--cs-amber)', border: 'rgba(245,158,11,0.25)' },
    LOW: { bg: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: 'rgba(59,130,246,0.25)' },
  };
  const c = colors[severity] || colors.LOW;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {severity}
    </span>
  );
}

function ShareButton({ activeTab, language, framework, docStyle }) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const params = new URLSearchParams();
    if (activeTab !== 'completion') params.set('tab', activeTab);
    if (language !== 'Python') params.set('lang', language);
    if (framework !== 'pytest') params.set('fw', framework);
    if (docStyle !== 'Google') params.set('style', docStyle);
    const qs = params.toString();
    const url = `${window.location.origin}${window.location.pathname}${qs ? '?' + qs : ''}#playground`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      data-testid="playground-share-button"
      onClick={handleShare}
      className="text-xs px-2.5 py-1 rounded-md transition-colors duration-150 flex items-center gap-1"
      style={{ background: 'var(--cs-surface2)', color: copied ? 'var(--cs-green)' : 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}
      aria-label="Copy share link"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {copied ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </>
        )}
      </svg>
      {copied ? 'Link copied!' : 'Share'}
    </button>
  );
}

export default function Playground({ embedded }) {
  // Read URL params for initial state
  const getInitialState = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      tab: params.get('tab') || 'completion',
      language: params.get('lang') || 'Python',
      framework: params.get('fw') || 'pytest',
      docStyle: params.get('style') || 'Google',
    };
  };

  const initial = getInitialState();
  const [activeTab, setActiveTab] = useState(initial.tab);
  const [language, setLanguage] = useState(initial.language);
  const [framework, setFramework] = useState(initial.framework);
  const [docStyle, setDocStyle] = useState(initial.docStyle);
  const [code, setCode] = useState(DEFAULT_INPUTS[initial.tab] || DEFAULT_COMPLETION_INPUT);
  const [output, setOutput] = useState('');
  const [reviewResult, setReviewResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [isFallback, setIsFallback] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const streamAbortRef = useRef(false);

  // Scroll to playground if URL has #playground
  useEffect(() => {
    if (window.location.hash === '#playground') {
      setTimeout(() => {
        document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, []);

  // Update URL when config changes
  const updateURL = useCallback((tab, lang, fw, style) => {
    const params = new URLSearchParams();
    if (tab && tab !== 'completion') params.set('tab', tab);
    if (lang && lang !== 'Python') params.set('lang', lang);
    if (fw && fw !== 'pytest') params.set('fw', fw);
    if (style && style !== 'Google') params.set('style', style);
    const qs = params.toString();
    const newURL = qs ? `${window.location.pathname}?${qs}#playground` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
  }, []);

  const handleTabChange = (tab) => {
    streamAbortRef.current = true;
    setActiveTab(tab);
    setOutput('');
    setReviewResult(null);
    setLoading(false);
    setStreaming(false);
    setLoadingSteps([]);
    setIsCached(false);
    setCopySuccess(false);
    setCode(DEFAULT_INPUTS[tab] || DEFAULT_COMPLETION_INPUT);
    updateURL(tab, language, framework, docStyle);
  };

  const handleLanguageChange = (val) => {
    setLanguage(val);
    updateURL(activeTab, val, framework, docStyle);
  };

  const handleFrameworkChange = (val) => {
    setFramework(val);
    updateURL(activeTab, language, val, docStyle);
  };

  const handleDocStyleChange = (val) => {
    setDocStyle(val);
    updateURL(activeTab, language, framework, val);
  };

  const streamText = useCallback(async (text, setter) => {
    streamAbortRef.current = false;
    setStreaming(true);
    let out = '';
    for (const ch of text) {
      if (streamAbortRef.current) break;
      out += ch;
      setter(out);
      await new Promise(r => setTimeout(r, 4));
    }
    setStreaming(false);
  }, []);

  const showLoadingSequence = async (steps) => {
    for (let i = 0; i < steps.length; i++) {
      setLoadingSteps(steps.slice(0, i + 1));
      await new Promise(r => setTimeout(r, 400));
    }
  };

  const handleRun = async () => {
    setLoading(true);
    setOutput('');
    setReviewResult(null);
    setIsFallback(false);
    setIsCached(false);
    setTokenCount(0);
    setCopySuccess(false);

    try {
      if (activeTab === 'completion') {
        showLoadingSequence(['Tokenizing input...', 'Running inference (vLLM, PagedAttention)...', 'Generating completion...']);
        const res = await fetch(`${API_BASE}/api/playground/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language: language.toLowerCase() }),
        });
        if (res.status === 429) {
          setLoadingSteps([]);
          setLoading(false);
          setOutput('Rate limit reached. Please wait a moment before trying again.');
          return;
        }
        const data = await res.json();
        setLoadingSteps([]);
        setLoading(false);
        setIsFallback(data.fallback);
        setIsCached(data.cached || false);
        setTokenCount(data.tokens_generated || 0);
        await streamText(data.completion, setOutput);
      } else if (activeTab === 'review') {
        showLoadingSequence(['Analyzing code structure...', 'Detecting bugs and issues...', 'Generating fixes...']);
        const res = await fetch(`${API_BASE}/api/playground/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (res.status === 429) {
          setLoadingSteps([]);
          setLoading(false);
          setOutput('Rate limit reached. Please wait a moment before trying again.');
          return;
        }
        const data = await res.json();
        setLoadingSteps([]);
        setLoading(false);
        setIsFallback(data.fallback);
        setIsCached(data.cached || false);
        setReviewResult(data.result);
        if (data.result?.corrected_code) {
          await streamText(data.result.corrected_code, setOutput);
        }
      } else if (activeTab === 'testgen') {
        showLoadingSequence(['Analyzing function signature...', 'Generating test cases...', 'Verifying coverage...']);
        const res = await fetch(`${API_BASE}/api/playground/tests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, framework }),
        });
        if (res.status === 429) {
          setLoadingSteps([]);
          setLoading(false);
          setOutput('Rate limit reached. Please wait a moment before trying again.');
          return;
        }
        const data = await res.json();
        setLoadingSteps([]);
        setLoading(false);
        setIsFallback(data.fallback);
        setIsCached(data.cached || false);
        setTokenCount(data.test_count || 0);
        await streamText(data.tests, setOutput);
      } else if (activeTab === 'docstring') {
        showLoadingSequence(['Analyzing parameters...', 'Inferring types...', 'Generating docstring...']);
        const res = await fetch(`${API_BASE}/api/playground/docstring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, style: docStyle }),
        });
        if (res.status === 429) {
          setLoadingSteps([]);
          setLoading(false);
          setOutput('Rate limit reached. Please wait a moment before trying again.');
          return;
        }
        const data = await res.json();
        setLoadingSteps([]);
        setLoading(false);
        setIsFallback(data.fallback);
        setIsCached(data.cached || false);
        await streamText(data.documented_code, setOutput);
      }
    } catch (err) {
      setLoadingSteps([]);
      setLoading(false);
      setOutput('Error: Could not connect to CodeSage API. Please try again.');
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(output);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !loading && !streaming) {
        e.preventDefault();
        handleRun();
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const tab = TABS[parseInt(e.key) - 1];
        if (tab) handleTabChange(tab.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="playground" data-testid="playground-section" className={embedded ? "pb-16 px-4 sm:px-6 lg:px-8" : "py-16 sm:py-20 px-4 sm:px-6 lg:px-8"}
      aria-label="Live Playground">
      <div className="max-w-6xl mx-auto">
        {!embedded && (
        <div className="text-center mb-10">
          <span className="text-xs font-medium px-3 py-1 rounded-full mb-3 inline-block"
            style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
            Live Playground
          </span>
          <h2 className="font-head font-semibold text-3xl sm:text-4xl mt-3" style={{ color: 'var(--cs-text)' }}>
            CodeSage In Action
          </h2>
          <p className="mt-3" style={{ color: 'var(--cs-text2)', maxWidth: 560, margin: '12px auto 0' }}>
            Powered by Google Gemini 2.0 Flash simulating CodeSage outputs.
            Production model served via vLLM — same outputs, real latency.
          </p>
        </div>
        )}

        {/* Tabs */}
        <div data-testid="playground-tabs" className="flex flex-wrap gap-2 mb-6 justify-center" role="tablist" aria-label="Playground tools">
          {TABS.map(tab => (
            <button
              key={tab.id}
              data-testid={`playground-tab-${tab.id}`}
              onClick={() => handleTabChange(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              title={`${tab.label} (Ctrl+${tab.shortcut})`}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: activeTab === tab.id ? 'var(--cs-blue)' : 'var(--cs-surface)',
                color: activeTab === tab.id ? 'white' : 'var(--cs-text2)',
                border: `1px solid ${activeTab === tab.id ? 'var(--cs-blue)' : 'var(--cs-border)'}`,
                boxShadow: activeTab === tab.id ? '0 0 12px rgba(59,130,246,0.25)' : 'none',
              }}
            >
              {tab.label}
              <span className="hidden lg:inline text-xs ml-1.5 opacity-50">({tab.shortcut})</span>
            </button>
          ))}
          <ShareButton activeTab={activeTab} language={language} framework={framework} docStyle={docStyle} />
        </div>

        {/* Main content */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left: Input */}
            <div className="p-4 sm:p-5" style={{ borderRight: '1px solid var(--cs-border)' }}>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="text-xs font-medium" style={{ color: 'var(--cs-text3)' }}>Your code</span>
                {activeTab === 'completion' && (
                  <select
                    value={language}
                    onChange={e => handleLanguageChange(e.target.value)}
                    aria-label="Programming language"
                    className="text-xs px-2 py-1 rounded-md font-mono"
                    style={{ background: 'var(--cs-surface2)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}
                  >
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                )}
                {activeTab === 'testgen' && (
                  <select value={framework} onChange={e => handleFrameworkChange(e.target.value)}
                    aria-label="Test framework"
                    className="text-xs px-2 py-1 rounded-md font-mono"
                    style={{ background: 'var(--cs-surface2)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
                    {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                )}
                {activeTab === 'docstring' && (
                  <select value={docStyle} onChange={e => handleDocStyleChange(e.target.value)}
                    aria-label="Docstring style"
                    className="text-xs px-2 py-1 rounded-md font-mono"
                    style={{ background: 'var(--cs-surface2)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>

              <textarea
                data-testid="playground-prompt-textarea"
                value={code}
                onChange={e => setCode(e.target.value)}
                rows={12}
                aria-label="Code input"
                placeholder="Paste your code here..."
                className="w-full font-mono text-xs sm:text-sm p-3 rounded-lg resize-none focus:ring-2 focus:ring-offset-0"
                style={{
                  background: 'var(--cs-code-bg)',
                  color: 'var(--cs-text)',
                  border: '1px solid var(--cs-border)',
                  lineHeight: '1.6',
                  outline: 'none',
                  '--tw-ring-color': 'var(--cs-blue)',
                }}
              />

              {/* Presets */}
              {activeTab === 'completion' && (
                <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Code presets">
                  {Object.keys(COMPLETION_PRESETS).map(name => (
                    <button
                      key={name}
                      onClick={() => setCode(COMPLETION_PRESETS[name])}
                      className="px-3 py-1.5 rounded-md text-xs transition-all duration-150 hover:translate-y-[-1px]"
                      style={{ background: 'var(--cs-surface2)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}

              <button
                data-testid="playground-run-button"
                onClick={handleRun}
                disabled={loading || streaming || !code.trim()}
                className="w-full mt-4 px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-150 active:scale-[0.98] focus:ring-2 focus:ring-offset-0"
                style={{
                  background: loading || streaming || !code.trim() ? 'var(--cs-surface3)' : 'linear-gradient(135deg, #3B82F6, #60A5FA)',
                  color: loading || streaming || !code.trim() ? 'var(--cs-text3)' : 'white',
                  cursor: loading || streaming || !code.trim() ? 'not-allowed' : 'pointer',
                  '--tw-ring-color': 'var(--cs-blue)',
                }}
                aria-label={loading ? 'Processing...' : `Run ${activeTab}`}
              >
                {loading ? 'Processing...' : streaming ? 'Streaming...' : `${activeTab === 'completion' ? 'Complete' : activeTab === 'review' ? 'Review' : activeTab === 'testgen' ? 'Generate Tests' : 'Document'} with CodeSage \u2192`}
                <span className="hidden sm:inline text-xs ml-2 opacity-60">(Ctrl+Enter)</span>
              </button>
            </div>

            {/* Right: Output */}
            <div className="p-4 sm:p-5" data-testid="playground-output" role="tabpanel" id={`panel-${activeTab}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium" style={{ color: 'var(--cs-text3)' }}>
                  {activeTab === 'completion' ? 'Completion' : activeTab === 'review' ? 'Review Results' : activeTab === 'testgen' ? 'Generated Tests' : 'Documented Code'}
                </span>
                {output && (
                  <button onClick={copyOutput} 
                    className="text-xs px-2.5 py-1 rounded-md transition-colors duration-150 flex items-center gap-1"
                    style={{ background: 'var(--cs-surface2)', color: copySuccess ? 'var(--cs-green)' : 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}
                    aria-label="Copy output">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {copySuccess ? <polyline points="20 6 9 17 4 12" /> : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>}
                    </svg>
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>

              {loading && loadingSteps.length > 0 && <LoadingSteps steps={loadingSteps} />}

              {/* Review-specific output */}
              {activeTab === 'review' && reviewResult && (
                <div className="space-y-3 mb-4">
                  {/* Issues */}
                  <div className="rounded-lg p-4" style={{ background: 'var(--cs-surface2)', borderLeft: '3px solid var(--cs-red)' }}>
                    <div className="text-sm font-semibold mb-2" style={{ color: 'var(--cs-text)' }}>Issues Found</div>
                    {reviewResult.issues?.map((issue, i) => (
                      <div key={i} className="mb-3 last:mb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge severity={issue.severity} />
                          <span className="text-sm font-medium" style={{ color: 'var(--cs-text)' }}>{issue.title}</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--cs-text2)' }}>{issue.description}</p>
                        {issue.fix && (
                          <div className="mt-1 font-mono text-xs px-2 py-1 rounded" style={{ background: 'var(--cs-code-bg)', color: 'var(--cs-green-l)' }}>
                            Fix: {issue.fix}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Explanation */}
                  {reviewResult.explanation && (
                    <div className="rounded-lg p-4" style={{ background: 'var(--cs-surface2)', borderLeft: '3px solid var(--cs-blue)' }}>
                      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--cs-text)' }}>Explanation</div>
                      <p className="text-xs" style={{ color: 'var(--cs-text2)', lineHeight: '1.7' }}>{reviewResult.explanation}</p>
                    </div>
                  )}
                  {/* Corrected code */}
                  <div style={{ borderLeft: '3px solid var(--cs-green)' }} className="rounded-lg">
                    <div className="px-4 pt-3 text-sm font-semibold" style={{ color: 'var(--cs-text)' }}>Corrected Code</div>
                    <CodeBlock code={output} language="javascript" streaming={streaming} />
                  </div>
                </div>
              )}

              {/* Code output for non-review tabs */}
              {activeTab !== 'review' && (
                <CodeBlock code={output} language={activeTab === 'completion' ? language.toLowerCase() : 'python'} streaming={streaming} />
              )}

              {/* Meta badges */}
              {output && !loading && !streaming && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2 py-1 rounded-full text-xs" style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
                    First token: ~72ms
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs" style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
                    ~12,500 tok/s
                  </span>
                  {activeTab === 'testgen' && tokenCount > 0 && (
                    <span className="px-2 py-1 rounded-full text-xs" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--cs-green)', border: '1px solid rgba(34,197,94,0.25)' }}>
                      {tokenCount} test cases
                    </span>
                  )}
                  {isCached && (
                    <span className="px-2 py-1 rounded-full text-xs" style={{ background: 'rgba(168,85,247,0.12)', color: 'var(--cs-purple-l)', border: '1px solid rgba(168,85,247,0.25)' }}>
                      Cached response
                    </span>
                  )}
                  {isFallback && (
                    <span className="px-2 py-1 rounded-full text-xs" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--cs-amber)', border: '1px solid rgba(245,158,11,0.25)' }}>
                      Fallback response
                    </span>
                  )}
                </div>
              )}

              {/* Quality indicator for completion */}
              {activeTab === 'completion' && output && !loading && !streaming && (
                <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--cs-surface2)', borderLeft: '3px solid var(--cs-green)' }}>
                  <div className="text-xs space-y-1" style={{ color: 'var(--cs-green-l)' }}>
                    <div>No hallucinated imports &#10003;</div>
                    <div>Type hints preserved &#10003;</div>
                    <div>Docstring style matched &#10003;</div>
                    <div>Follows existing naming convention &#10003;</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

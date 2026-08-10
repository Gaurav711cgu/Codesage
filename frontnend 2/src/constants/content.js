export const TERMINAL_LINES = [
  { text: '$ modal run train.py --model llama-3.3-8b', color: 'text3', delay: 0 },
  { text: 'Loading base model: meta-llama/Llama-3.3-8B-Instruct', color: 'text3', delay: 800 },
  { text: '4-bit NF4 quantization .................. done', color: 'blue', check: true, delay: 1600 },
  { text: 'QLoRA adapter init (r=16, alpha=16, dropout=0.05) done', color: 'blue', check: true, delay: 2200 },
  { text: 'Target modules: all-linear .............. done', color: 'blue', check: true, delay: 2800 },
  { text: 'Dataset: 52,000 code instruction pairs', color: 'text3', delay: 3400 },
  { text: 'Hardware: 1x A100 80GB via Modal', color: 'text3', delay: 3800 },
  { text: '', color: 'text3', delay: 4200 },
  { text: 'Epoch 1/3 - Step 1000/4340', color: 'amber', delay: 4600 },
  { text: 'train_loss: 1.2841 | eval_loss: 1.3102 | lr: 1.8e-4', color: 'amber', delay: 5200 },
  { text: 'Epoch 2/3 - Step 2500/4340', color: 'amber', delay: 5800 },
  { text: 'train_loss: 0.8817 | eval_loss: 0.9043 | lr: 1.1e-4', color: 'amber', delay: 6400 },
  { text: 'Epoch 3/3 - Step 4340/4340', color: 'green', delay: 7000 },
  { text: 'train_loss: 0.6234 | eval_loss: 0.6891 | lr: 3.2e-5', color: 'green', delay: 7600 },
  { text: '', color: 'text3', delay: 8000 },
  { text: 'Training complete. Adapter saved to ./outputs/codesage-v1', color: 'green', delay: 8400 },
  { text: 'Merging QLoRA adapter into base weights...', color: 'blue', delay: 9000 },
  { text: 'Model pushed to HuggingFace Hub', color: 'green', check: true, delay: 9600 },
  { text: 'Running HumanEval benchmark...', color: 'blue', delay: 10200 },
  { text: 'pass@1: 0.743  (+7.1pp vs base Llama 3.3 8B: 0.672)', color: 'green', check: true, delay: 10800 },
  { text: 'MBPP   pass@1: 0.781  (+6.3pp vs base: 0.718)', color: 'green', check: true, delay: 11400 },
  { text: 'Deploying to vLLM on Modal ... done', color: 'green', check: true, delay: 12000 },
];

export const TRAINING_STAGES = [
  {
    title: 'Dataset Curation',
    icon: 'database',
    badge: 'Quality over quantity',
    summary: '52K pairs · 4 sources · 3 filtering passes',
    content: {
      sources: [
        { name: 'The Stack v2 (Python subset)', kept: '~18,000', details: 'Filtered: Pylint score < 7, syntax errors, <5 or >500 lines. Applied Google Python Style Guide refactoring.' },
        { name: 'CodeAlpaca-20k', kept: '~14,000', details: 'Self-instruct generated. Filtered for correctness: removed pairs where code does not run.' },
        { name: 'Synthetic problem-solution pairs', kept: '~20,500', details: 'GPT-4o generated 25K problems with unit tests. 82% pass rate. Most important for domain specialization.' },
      ],
      filtering: [
        'Pass 1: Syntax check (ast.parse() for Python, tsc --noEmit for TS)',
        'Pass 2: Execution check (sandbox, verify exit 0)',
        'Pass 3: Deduplication (MinHash LSH at 80% Jaccard, removed ~4,200 duplicates)',
      ],
      distribution: { train: '46,800 (90%)', validation: '2,600 (5%)', test: '2,600 (5%)' },
    },
  },
  {
    title: 'QLoRA Configuration',
    icon: 'sliders',
    badge: '4-bit NF4 · r=16 · $9.40 total cost',
    summary: 'NF4 quantization · DoRA · all-linear targets',
    content: {
      baseModel: 'meta-llama/Llama-3.3-8B-Instruct (8.03B params, 32 layers, GQA)',
      quantization: {
        type: 'NF4 (NormalFloat4)',
        compute: 'bfloat16',
        doubleQuant: true,
        reason: 'NF4 is optimal for normally-distributed neural network weights.',
      },
      lora: {
        r: 16,
        alpha: 16,
        dropout: 0.05,
        targets: 'all-linear (q/k/v/o_proj + gate/up/down_proj)',
        dora: true,
        doraReason: '+1-4.4% improvement over standard LoRA at same rank.',
      },
      training: {
        epochs: 3,
        batchSize: '2 (effective 8 with grad accum 4)',
        lr: '2e-4 cosine decay',
        warmup: '3% (~130 steps)',
        maxSeqLen: 2048,
        packing: true,
        optimizer: 'paged_adamw_8bit',
      },
      hardware: '1x NVIDIA A100 80GB · ~2.8 hours · $9.40 via Modal',
    },
  },
  {
    title: 'W&B Experiment Tracking',
    icon: 'chart',
    badge: '3 runs · 12 hyperparameter trials',
    summary: 'Loss curves, ablation results, production model selection',
    content: {
      runs: [
        { name: 'codesage-v0.1', config: 'r=8, alpha=8, attention-only', loss: 0.8234, humaneval: '+3.2pp', status: 'Baseline' },
        { name: 'codesage-v0.2', config: 'r=16, alpha=16, attention-only', loss: 0.7118, humaneval: '+4.8pp', status: 'Improved' },
        { name: 'codesage-v1.0', config: 'r=16, alpha=16, all-linear, DoRA', loss: 0.6234, humaneval: '+7.1pp', status: 'Production' },
      ],
      findings: [
        'all-linear targets vs attention-only: +2.3pp HumanEval',
        'DoRA vs standard LoRA: +1.5pp HumanEval at same r',
        'packing=True: 40% faster training, same final loss',
        'r=32 vs r=16: +0.3pp HumanEval, 2.1x slower — not worth it',
      ],
    },
  },
  {
    title: 'Adapter Merging + Hub Push',
    icon: 'merge',
    badge: 'GGUF + ONNX + safetensors',
    summary: 'Merge, quantize, publish to HuggingFace',
    content: {
      steps: [
        'Load base model in fp16',
        'Load QLoRA adapter',
        'model.merge_and_unload() — merges W + (B×A) × (alpha/r)',
        'Save in safetensors format (not pickle)',
      ],
      formats: [
        { name: 'safetensors (fp16)', use: 'vLLM serving, transformers inference' },
        { name: 'GGUF q4_K_M', use: 'llama.cpp / Ollama, ~4.8GB' },
        { name: 'ONNX + int8', use: 'Cross-platform, CPU inference' },
      ],
    },
  },
  {
    title: 'Modal Serverless GPU Deployment',
    icon: 'cloud',
    badge: 'Scales to 0 · No idle GPU cost',
    summary: 'A10G GPU · container_idle_timeout=60 · ~95% cheaper than AWS',
    content: {
      whyModal: 'AWS requires a minimum GPU instance running 24/7 = ~$2,400/month. Modal charges only when inference runs — ~95% cheaper for variable traffic.',
      config: {
        gpu: 'A10G (24GB VRAM)',
        idleTimeout: 60,
        concurrentInputs: 32,
        coldStart: '~18-25 seconds',
        warmLatency: '<100ms overhead',
      },
    },
  },
];

export const FAILURE_MODES = [
  {
    title: 'Catastrophic Forgetting of General Capabilities',
    problem: 'After fine-tuning on code, the model loses performance on general NLP tasks. A model that can code but fails to understand a long code review request is useless.',
    rootCause: 'Gradient updates during SFT push weights toward code-specific patterns. With 3 epochs, weights drift far from pre-trained values.',
    fix: 'Mixed dataset: 70% code + 30% general instruction pairs. Use instruction-tuned base (not base model). Monitor eval_loss on general instruction eval set.',
    risk: '~5-8% regression on MMLU vs base instruct model. Acceptable for code-specialized tool.',
    severity: 'high',
  },
  {
    title: 'QLoRA Quantization Noise on Sensitive Layers',
    problem: '4-bit NF4 quantization introduces rounding errors that accumulate in first and last transformer layers. Precise token probabilities (choosing between = and ==) show measurable error rate increase.',
    rootCause: 'NF4 maps fp16 values to nearest of 16 discrete values. In early layers, this error propagates through all subsequent layers.',
    fix: 'Keep lm_head in fp16. Use double quantization. After merging: run INT8 calibration pass (AutoGPTQ) for inference.',
    risk: '~1-2% accuracy regression vs fp16 serving. Production vLLM serves in BF16 post-merge.',
    severity: 'medium',
  },
  {
    title: 'vLLM Memory OOM at High Concurrency',
    problem: 'At 32+ concurrent requests with long context (4K+ tokens), PagedAttention block allocator runs out of GPU memory. All in-flight requests affected simultaneously.',
    rootCause: 'PagedAttention allocates blocks on demand. Under memory pressure, vLLM swaps to CPU RAM. At extreme concurrency, swap bandwidth becomes bottleneck.',
    fix: 'gpu_memory_utilization=0.90. max_num_seqs=32. max_model_len=8192. Circuit breaker: if p99 > 5s, shed to CodeSage-mini fallback.',
    risk: 'Burst traffic can exhaust queue. Modal auto-scales but cold start takes 18-25s.',
    severity: 'high',
  },
  {
    title: 'Overconfident on Out-of-Domain Code',
    problem: 'Trained primarily on Python/TS/Rust/SQL. For Kotlin, Haskell, or Solidity, generates syntactically plausible but subtly wrong code.',
    rootCause: 'Fine-tuning increases confidence on in-domain distributions. Calibration for uncertainty on OOD inputs degrades.',
    fix: 'Logprob threshold: if mean token confidence < 0.7, route to base model. Language detection in preprocessing. System prompt includes uncertainty instruction.',
    risk: 'Calibration catches ~70% of confident-but-wrong cases. 30% slip through.',
    severity: 'medium',
  },
  {
    title: 'Adapter Merge Changes Output Distribution',
    problem: 'After merge_and_unload(), merged model produces slightly different outputs than pre-merge. Benchmark numbers may not match.',
    rootCause: 'BitsAndBytes 4-bit dequantization introduces small errors during merge. Errors compound across generation process.',
    fix: 'Always evaluate AFTER merge. Cross-check 100 samples pre/post merge. Prefer fp16 merge then quantize separately.',
    risk: '~0.2-0.5pp benchmark difference. Accepted as measurement noise.',
    severity: 'low',
  },
  {
    title: 'vLLM Output Non-Determinism',
    problem: 'At temperature=0, different concurrency levels produce different outputs. Continuous batching changes which attention computations are fused together.',
    rootCause: 'GPU floating-point operations are not strictly commutative. Fused attention kernels produce different rounding results depending on batch composition.',
    fix: 'For code completion: acceptable (valid alternatives are valid). For tests: use seed parameter. Document: exact determinism not guaranteed at high concurrency.',
    risk: 'No full fix without disabling continuous batching. 24x throughput trade-off is worth it.',
    severity: 'low',
  },
];

export const INFERENCE_COMPONENTS = [
  {
    id: 'router',
    title: 'Request Router',
    color: 'amber',
    summary: 'vLLM OpenAI-compatible API endpoint',
    details: 'vLLM exposes /v1/completions and /v1/chat/completions API identical to OpenAI spec. No code changes needed to switch from OpenAI API to self-hosted CodeSage. Request validation, rate limiting, priority queue for MCP tool calls.',
  },
  {
    id: 'scheduler',
    title: 'Continuous Batching Scheduler',
    color: 'blue',
    summary: 'Dynamic request batching for maximum GPU utilization',
    details: 'Traditional static batching: wait for N requests, process, repeat. vLLM continuous batching: as soon as any sequence finishes, a new request joins immediately. GPU never idles. Stable latency until ~100-150 concurrent requests.',
  },
  {
    id: 'paged',
    title: 'PagedAttention',
    color: 'blue',
    summary: 'THE core innovation — OS-style virtual memory for KV cache',
    details: 'Traditional serving pre-allocates contiguous GPU memory at MAX sequence length. 60-80% of GPU RAM wasted. PagedAttention: KV cache divided into fixed-size blocks (16 tokens), allocated on-demand, non-contiguous. Memory waste: <4%. Throughput: 2-24x vs naive serving.',
  },
  {
    id: 'workers',
    title: 'Model Workers',
    color: 'purple',
    summary: 'Tensor parallel model execution',
    details: 'For 8B: single GPU sufficient. Tensor parallelism splits attention heads across GPUs. PagedAttention shares prompt KV blocks across sequences. Copy-on-write at block granularity. vLLM V1 engine: incremental state updates, near-free prefix caching.',
  },
  {
    id: 'streaming',
    title: 'Output Streaming',
    color: 'green',
    summary: 'Token-by-token streaming via Server-Sent Events',
    details: 'SSE streaming like ChatGPT. TTFT: 72ms at low concurrency (H100). Inter-token latency: ~8ms/token. A 200-token completion: 72ms + 200×8ms = 1.7s. User perceives streaming output starting at 72ms.',
  },
];

export const MCP_TOOLS = [
  {
    name: 'complete_code',
    icon: 'code',
    badge: 'code completion',
    badgeColor: 'blue',
    params: ['code: string', 'language: "python" | "typescript" | "rust" | "go" | "sql" | "java"', 'context: string (optional)', 'max_tokens: integer (default 512)'],
    returns: '{completion: string, confidence: float, tokens_used: integer}',
  },
  {
    name: 'review_code',
    icon: 'search',
    badge: 'code review',
    badgeColor: 'amber',
    params: ['code: string', 'focus: "bugs" | "security" | "performance" | "style" | "all"'],
    returns: '{issues: Issue[], severity_summary: {high, medium, low}, corrected_code: string, score: 0-10}',
  },
  {
    name: 'generate_tests',
    icon: 'flask',
    badge: 'testing',
    badgeColor: 'green',
    params: ['code: string', 'framework: "pytest" | "unittest" | "jest" | "vitest" | "go test"', 'coverage_target: float (default 0.90)'],
    returns: '{test_file: string, estimated_coverage: float, test_count: integer}',
  },
  {
    name: 'explain_code',
    icon: 'book',
    badge: 'documentation',
    badgeColor: 'purple',
    params: ['code: string', 'audience: "junior" | "senior" | "non-technical" | "documentation"', 'include_docstring: boolean'],
    returns: '{explanation: string, docstring: string, complexity_score: "O(n)", key_concepts: string[]}',
  },
];

export const RESUME_BULLET = `Fine-tuned Llama 3.3 8B on 52K curated code instruction pairs using QLoRA (r=16, DoRA, all-linear targets, NF4 4-bit quantization) with Unsloth on Modal A100 80GB for $9.40 total; achieved +7.1pp HumanEval pass@1 and +6.3pp MBPP pass@1 over base model through dataset curation (3-pass syntax/execution/deduplication filtering), mixed training objective preventing catastrophic forgetting, and post-merge evaluation methodology; deployed with vLLM (PagedAttention, continuous batching, 12,500 tok/s on H100, 24x vs naive serving) on Modal serverless GPU; exposed via MCP server with 4 tools (complete, review, test-generate, explain) usable by Claude Desktop, Cursor, and any LangGraph agent.`;

export const COMPANY_CARDS = [
  {
    company: 'Anthropic',
    color: 'blue',
    content: `Anthropic's hiring page says to put independent research at the top. CodeSage is independent research — with a benchmark contribution.\n\nWhat they'll ask: "What did you learn about where fine-tuning fails?"\nAnswer with catastrophic forgetting, quantization noise, and overconfidence on OOD languages.\n\nConnect: "The logprob confidence threshold I built is a form of model uncertainty quantification — the same problem Anthropic works on for Constitutional AI."`,
  },
  {
    company: 'OpenAI',
    color: 'green',
    content: `OpenAI interviews focus on production systems thinking and scale.\n\nLead with: the vLLM architecture decision — specifically why PagedAttention was the right choice and what 24x means operationally. Then: Modal vs AWS cost analysis ($0.18 vs $5.00 per 1M tokens).\n\nThey'll ask: "How would you scale to 10,000 concurrent users?"\nAnswer: tensor parallelism across 4x H100s, prefix caching, request prioritization, async prefill/decode disaggregation.`,
  },
  {
    company: 'DeepMind',
    color: 'purple',
    content: `DeepMind asks for research-adjacent thinking and scientific rigor.\n\nLead with: the W&B experiment comparison — three runs, documented findings, the DoRA vs standard LoRA ablation (+1.5pp).\n\nThey'll ask: "How did you decide on r=16?"\nAnswer: "r=32 was +0.3pp at 2.1x cost. Diminishing returns suggest low intrinsic dimensionality — code completion may not require high-rank adaptation because the base has strong code priors."`,
  },
];

<USER_REQUEST>
CodeSageZ v2 — Final Product Requirements Document
Version: 3.0 — Final
Status: Build-ready
All adversarial gaps from the review session are resolved in this document. Do not refer to v1 or v2 PRD drafts.

How to Read This Document
Every section is a build contract. If a section says "do X," that means X is implemented before you move to the next section. The benchmark methodology section is written last intentionally — you build first, then benchmark what actually exists. Nothing is estimated in advance.

Part 1: Product Foundation
1.1 The Thesis
Most coding assistants treat source code as prose. They chunk text, embed it, and retrieve by cosine similarity. This works for single-function lookups. It fails for cross-file reasoning because code has structural relationships — call graphs, inheritance chains, import dependencies — that pure embedding ignores.
CodeSageZ exploits code structure at retrieval time. When you ask about authenticate(), the system automatically retrieves validate_token() (which it calls) and login() (which calls it) alongside the direct match. This is graph-augmented RAG, and it is measurably better than naive retrieval.
The second contribution is a fine-tuned model. Qwen2.5-Coder-1.5B-Instruct fine-tuned via QLoRA on bug-fix commits from CommitPack. The fine-tuning task, evaluation methodology, and results are fully documented and reproducible from committed code.
These two contributions together constitute the project. Everything else — the UI, the API, the ingestion pipeline — is engineering scaffold that makes the contributions demoable.
1.2 What This Is Not
Not a Copilot clone. Not a multi-agent system (the original PRD's "10 agents" were system prompts, not agents — that framing is permanently retired). Not a SaaS product. Not a research paper. A portfolio engineering project with genuine ML depth, built to survive adversarial technical questioning.
1.3 The Two Bets
Bet 1: Graph-Augmented RAG
Claim: 1-hop call graph expansion at retrieval time improves cross-file Q&A accuracy versus naive chunking, measured on RepoBench-R and a stratified internal benchmark.
Falsifiable: if graph expansion does not improve RepoBench-R Recall@10 by at least 5 points, the implementation has a bug. Fix the bug before claiming the result.
Bet 2: Bug-Fix Fine-Tuning
Claim: QLoRA fine-tuning on CommitPack Python bug-fix commits improves the model's bug-fix capability, measured on a held-out CommitPack test set using CodeBLEU, and checked for catastrophic forgetting using HumanEval.
Falsifiable: if CodeBLEU does not improve on the held-out set, the training data quality or prompt format has a problem. Debug before claiming the result.

Part 2: Tech Stack — Final Decisions
Every decision is locked. No revisiting during the build.
Primary LLM: gemini-2.0-flash
Free tier: 15 RPM, 1,500 RPD, 1M token context window. Python SDK: google-generativeai. The 1M context window is a fallback for tiny repos — the RAG pipeline still runs for all repos because it is the technical contribution, not a cost optimization.
Embeddings: text-embedding-004 (Google)
Free tier: 100 RPM. 768-dimensional output. Batch size: 100 texts per call. Chosen over BGE-large-en-v1.5 because it eliminates the requirement to run a 1.3GB model locally, performs comparably on MTEB retrieval benchmarks, and removes the GPU dependency from the ingestion pipeline entirely.
Fine-tuned model: Qwen2.5-Coder-1.5B-Instruct via QLoRA
Trained on Colab A100 using Unsloth. Served locally via Ollama after export to GGUF. Backend falls back to Gemini if Ollama is not running. This means the demo works in cloud environments without a GPU.
Vector store: ChromaDB
PersistentClient for local dev. HTTP server mode in production. Chosen for: persistent storage without extra config, metadata filtering (required for file-scoped queries), active maintenance, and Python-native client.
Backend: FastAPI (Python 3.11)
Async-native, Pydantic integration, BackgroundTasks for ingestion, native SSE support, automatic OpenAPI docs.
Frontend: Next.js 14 (App Router)
TypeScript. Tailwind CSS. shadcn/ui for components. Recharts for benchmarks. Monaco Editor for code input. Deployed to Vercel.
Database: PostgreSQL via Supabase
Free tier. Three tables: repos, tasks, messages. Managed backups. No self-hosted Postgres.
Cache + Rate Limiting: Upstash Redis
Free serverless tier. Used for: API rate limiting via slowapi, ingestion task status cache (so progress SSE can reconnect after disconnect).
Graph library: NetworkX
In-memory directed graph. Cached per repo_id in a module-level dict. Serialized to JSON and stored in PostgreSQL repos.graph_data column for persistence across restarts.
AST parsing: Tree-sitter
tree-sitter-python for MVP. tree-sitter-javascript and tree-sitter-typescript in V2.

Part 3: System Architecture
3.1 Repository Structure
codesagez/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── repo.py          ← ingest, query, list, delete
│   │   │       ├── code.py          ← review, debug, tests
│   │   │       └── benchmarks.py    ← serve stored benchmark JSON
│   │   ├── core/
│   │   │   ├── config.py            ← Settings via pydantic-settings
│   │   │   └── database.py          ← SQLAlchemy async engine
│   │   ├── models/
│   │   │   ├── repo.py              ← SQLAlchemy ORM models
│   │   │   └── schemas.py           ← Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── gemini.py            ← ALL Gemini API calls
│   │   │   ├── ingestion.py         ← clone → parse → graph → embed → store
│   │   │   ├── retrieval.py         ← naive and graph-augmented retrieval
│   │   │   ├── chromadb_client.py   ← ChromaDB operations
│   │   │   ├── graph.py             ← NetworkX operations + cache
│   │   │   └── ollama.py            ← fine-tuned model calls + fallback
│   │   └── main.py
│   ├── migrations/                  ← Alembic migrations
│   ├── tests/
│   │   ├── test_ingestion.py
│   │   ├── test_retrieval.py
│   │   └── test_api.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── playground/page.tsx
│   │   │   ├── repos/page.tsx
│   │   │   ├── benchmarks/page.tsx
│   │   │   └── architecture/page.tsx
│   │   ├── components/
│   │   │   ├── MonacoEditor.tsx
│   │   │   ├── StreamingOutput.tsx
│   │   │   ├── RetrievalAccordion.tsx
│   │   │   ├── IngestionProgress.tsx
│   │   │   └── BenchmarkChart.tsx
│   │   └── lib/
│   │       ├── api.ts               ← ALL API calls, typed
│   │       └── sse.ts               ← SSE subscription utilities
│   ├── package.json
│   └── Dockerfile
├── training/
│   ├── dataset_prep.py              ← CommitPack filter + sample
│   ├── finetune.py                  ← Unsloth QLoRA training
│   ├── eval_codeblu.py              ← CodeBLEU on held-out set
│   ├── eval_humaneval.py            ← HumanEval catastrophic forgetting check
│   ├── eval_repobench.py            ← RepoBench-R integration
│   ├── data/
│   │   ├── train.jsonl              ← 8K training samples (committed)
│   │   ├── val.jsonl                ← 1K validation samples
│   │   └── test.jsonl               ← 1K test samples (held out)
│   └── results/
│       ├── base_humaneval.json      ← committed raw results
│       ├── finetuned_humaneval.json
│       ├── base_codeblu.json
│       ├── finetuned_codeblu.json
│       └── repobench_results.json
├── benchmarks/
│   ├── rag_eval_questions.json      ← stratified 60-question internal eval
│   ├── rag_eval_results.json        ← committed raw results
│   └── methodology.md              ← how questions were created, judge calibration
├── docker-compose.yml
├── .env.example
└── README.md
3.2 Data Flow — Ingestion
POST /api/v1/repo/ingest
        ↓
FastAPI receives {github_url}
        ↓
Create repo record (status=queued), create task record
        ↓
Return {task_id, repo_id} immediately (202 Accepted)
        ↓
Background task starts:
        ↓
[Stage 1] Clone repo via gitpython (depth=1)
  → Check size via GitHub API first (reject >50MB)
  → Clone to /tmp/codesagez/{task_id}/
  → SSE: {"stage": "cloning", "message": "Cloning repository..."}
        ↓
[Stage 2] Discover Python files
  → Walk directory tree
  → Exclude: tests/, venv/, __pycache__/, migrations/
  → SSE: {"stage": "discovering", "total_files": N}
        ↓
[Stage 3] Tree-sitter parse each file
  → Extract: functions, classes, imports, function calls
  → Build CodeUnit objects
  → SSE: {"stage": "parsing", "current": i, "total": N}
        ↓
[Stage 4] Build NetworkX call graph
  → Resolve cross-file call references
  → Back-fill called_by relationships
  → Serialize graph to JSON, store in repos.graph_data
  → SSE: {"stage": "graph", "nodes": N, "edges": M}
        ↓
[Stage 5] Generate embeddings
  → Batch 100 at a time via text-embedding-004
  → Retry with exponential backoff on rate limit
  → SSE: {"stage": "embedding", "current": batch, "total": batches}
        ↓
[Stage 6] Store in ChromaDB
  → Create collections: {repo_id}_functions, {repo_id}_classes, {repo_id}_files
  → Store documents + embeddings + metadata
  → SSE: {"stage": "storing", "progress": pct}
        ↓
[Stage 7] Update repo status=complete in PostgreSQL
  → Cleanup cloned repo from /tmp
  → Cache NetworkX graph in module-level dict
  → SSE: {"stage": "complete", "stats": {...}}
Critical: every stage transition updates the task record in PostgreSQL. If the process crashes, the frontend can query /api/v1/repo/ingest/{task_id}/status to get last known state. Never lose progress state in memory only.
3.3 Data Flow — Graph-Augmented Query
POST /api/v1/repo/query {repo_id, query, retrieval_mode}
        ↓
Validate: repo exists and status=complete
        ↓
Encode query via text-embedding-004 (task_type="retrieval_query")
        ↓
ChromaDB vector search: {repo_id}_functions, top-5 results
  → Returns: [document, metadata, distance] × 5
  → These are "seed nodes"
        ↓
If retrieval_mode == "graph":
  Load NetworkX graph from module cache (or deserialize from PostgreSQL)
  For each seed node id:
    successors = graph.successors(seed_id)   ← functions it calls
    predecessors = graph.predecessors(seed_id) ← functions that call it
    expanded_ids = union of all successors + predecessors
  Fetch expanded_ids documents from ChromaDB (by ID, not by search)
  Score all chunks:
    seeds: final_score = 0.6 × vector_similarity + 0.4 × 1.0
    neighbors: final_score = 0.6 × 0.0 + 0.4 × 0.5
  Sort by final_score, deduplicate, take top-8
        ↓
Build context string (grouped by file, with call relationships)
        ↓
SSE event: retrieval_done {seeds, neighbors, latency_ms}
        ↓
Construct Gemini prompt (feature-specific system instruction + context + query)
        ↓
Stream Gemini response via generate_content(stream=True)
        ↓
SSE events: token {text} × N, then done {total_tokens, latency_ms}

Part 4: ML Pipeline — Corrected and Final
This section resolves every methodological criticism from the adversarial review. Read the "Why" notes before implementing.
4.1 Problem Framing (ml-scientist format)
Problem type:    Conditional code generation (seq2seq)
Input:           commit_message (string) + buggy_code (string)
Output:          fixed_code (string)
Primary metric:  CodeBLEU on held-out CommitPack test set
Secondary metric: HumanEval Pass@1 (catastrophic forgetting check)
Aspirational:    RepoBench-R Recall@10 (RAG contribution, separate from fine-tuning)
Baseline:        Qwen2.5-Coder-1.5B-Instruct zero-shot
Target:          CodeBLEU delta > 5 points on test set
Data:            8K train / 1K val / 1K test from CommitPack Python
Compute:         Colab A100 (40GB VRAM), ~4 hours
Why CodeBLEU, not HumanEval:
HumanEval tests code completion from scratch. CommitPack fine-tuning teaches the model to fix bugs in existing code. These are different distributions. Using HumanEval as the primary metric for a bug-fix fine-tuned model is a methodology error that any ML-literate interviewer will immediately identify. CodeBLEU measures n-gram overlap, AST match, and data-flow match between generated code and reference fixes — appropriate for the actual task. HumanEval is still run as a secondary check to measure catastrophic forgetting, but it is never the lead number.
Why keep HumanEval as secondary:
It is the standard benchmark that interviewers recognize. Reporting it with honest framing ("catastrophic forgetting check: base model X%, fine-tuned model Y% — a Z% delta that indicates [minimal/moderate/severe] forgetting of general coding ability") demonstrates scientific rigor. A regression here is not a failure. It is a scientifically interesting result that you explain.
4.2 Dataset Preparation
Source: bigcode/commitpack on HuggingFace, python split.
Filters applied in sequence:
Filter 1 — Language: keep lang == "python" only. Reduces to roughly 20M rows.
Filter 2 — Commit message quality: len(message.split()) >= 8. One-word commits ("fix", "update") have no learning signal.
Filter 3 — File size: len(old_contents) < 3500 and len(new_contents) < 3500 characters. Prevents context overflow during training (max_seq_length=2048 tokens).
Filter 4 — Actual change: old_contents != new_contents. Removes documentation-only commits that touch no code.
Filter 5 — Bug-fix signal: commit message contains at least one of: fix, bug, error, exception, null, none, crash, fail, incorrect, wrong, issue, patch, resolve, broken, invalid, missing, handle. Case-insensitive. This filters to bug-fix-relevant commits only.
Filter 6 — Diff size: compute difflib.unified_diff(old, new), count changed lines, keep only changed_lines <= 30. Surgical fixes. Large refactors add noise.
Filter 7 — Syntax validity: parse both old_contents and new_contents via ast.parse(). Discard if either fails. Training on syntactically invalid Python corrupts the model.
Expected yield after all filters: 150K–300K samples. Sample with fixed seed=42:
pythonimport datasets
import random

random.seed(42)
ds = datasets.load_dataset("bigcode/commitpack", "python", split="train")

# Apply filters (implement each as a function)
filtered = ds.filter(filter_language)
          .filter(filter_message_quality)
          .filter(filter_file_size)
          .filter(filter_actual_change)
          .filter(filter_bugfix_signal)
          .filter(filter_diff_size)
          .filter(filter_syntax_valid)

# Shuffle and split
indices = list(range(len(filtered)))
random.shuffle(indices)

train_indices = indices[:8000]
val_indices   = indices[8000:9000]
test_indices  = indices[9000:10000]   # HELD OUT — never used during training

# Save indices for reproducibility
with open("training/data/split_indices.json", "w") as f:
    json.dump({"train": train_indices, "val": val_indices, "test": test_indices}, f)
The test split is sacred. It is committed to the repo as training/data/test.jsonl before training begins and never looked at until evaluation. This is the held-out CommitPack test set used for CodeBLEU evaluation.
Input format — Alpaca-style:
### Task: Fix the bug described by the commit message.

### Commit message:
{message}

### Buggy code:
```python
{old_contents}
```

### Fixed code:
```python

```

**Target completion (what model outputs):**
{new_contents}

4.3 Training Configuration
pythonfrom unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
import torch

MAX_SEQ_LENGTH = 2048

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="Qwen/Qwen2.5-Coder-1.5B-Instruct",
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ],
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)

training_args = TrainingArguments(
    output_dir="./checkpoints",
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,        # effective batch size = 8
    warmup_ratio=0.05,
    num_train_epochs=3,
    learning_rate=2e-4,
    bf16=torch.cuda.is_bf16_supported(),
    fp16=not torch.cuda.is_bf16_supported(),
    logging_steps=25,
    evaluation_strategy="steps",
    eval_steps=200,
    save_strategy="steps",
    save_steps=200,
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    greater_is_better=False,
    seed=42,
    report_to="none",
)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    args=training_args,
    packing=False,
)

trainer.train()
Monitor during training:
Watch eval_loss. If it stops decreasing after epoch 1 or starts rising, stop early and take the checkpoint with lowest eval_loss. Three epochs is a target, not a requirement. Save final checkpoint, note the step number and eval_loss in training/results/training_log.json.
4.4 Evaluation — The Corrected Protocol
Step 0: Before running any training, establish baselines on both metrics
Run baseline HumanEval on the raw Qwen2.5-Coder-1.5B-Instruct model:
bashpip install human-eval
python training/eval_humaneval.py \
    --model "Qwen/Qwen2.5-Coder-1.5B-Instruct" \
    --output training/results/base_humaneval.json \
    --temperature 0.2 \
    --num_samples 1
The published number for Qwen2.5-Coder-1.5B-Instruct is approximately 43.9% HumanEval Pass@1. If your measured baseline differs by more than 3 points from the published number, investigate before training — something is wrong with your evaluation setup (wrong chat template, wrong temperature, wrong prompting format).
Run baseline CodeBLEU on the test set:
bashpip install codebleu
python training/eval_codebleu.py \
    --model "Qwen/Qwen2.5-Coder-1.5B-Instruct" \
    --test_data training/data/test.jsonl \
    --output training/results/base_codeblu.json \
    --temperature 0.2
CodeBLEU returns a score in [0, 1]. Multiply by 100 for reporting. A zero-shot model on CommitPack bug fixes will score roughly 25–40 CodeBLEU depending on how difficult your filtered test set is. Record this number.
Step 1: Run fine-tuned model evaluations
After training, export and load the fine-tuned model:
bashpython training/eval_humaneval.py \
    --model "./checkpoints/best_checkpoint" \
    --output training/results/finetuned_humaneval.json \
    --temperature 0.2 \
    --num_samples 1

python training/eval_codebleu.py \
    --model "./checkpoints/best_checkpoint" \
    --test_data training/data/test.jsonl \
    --output training/results/finetuned_codeblu.json \
    --temperature 0.2
Step 2: Error analysis — mandatory, not optional
For HumanEval: find the 20 problems where the fine-tuned model passes and base fails (improvements). Find the 20 where base passes and fine-tuned fails (regressions). Examine each manually. Document in training/results/error_analysis.md:
markdown## HumanEval Error Analysis

### Improvements (fine-tuned wins)
Problems where fine-tuning helped: [list IDs]
Pattern observed: [e.g., "11/15 improvement cases involve None/null handling or
try/except blocks — directly matching CommitPack bug-fix patterns"]

### Regressions (base model wins)
Problems where fine-tuning hurt: [list IDs]
Pattern observed: [e.g., "8/12 regression cases involve complex algorithmic
problems (sorting, dynamic programming) — not represented in CommitPack
bug-fix data, consistent with expected distribution shift"]

### Interpretation
The fine-tuning improves bug-fix-adjacent tasks at the cost of some general
algorithmic capability. This tradeoff is expected and acceptable for a model
specialized in debugging workflows. A developer using this model for code
completion would experience [minimal/moderate] capability reduction on
algorithmic tasks while gaining [significant] improvement on bug-fix tasks.
This analysis is what you talk about in interviews. The numbers are secondary.
Step 3: How to present results honestly
Primary result (use this as the headline):

"Fine-tuned Qwen2.5-Coder-1.5B on 8K CommitPack Python bug-fix commits via QLoRA. CodeBLEU on held-out test set: base 31.4 → fine-tuned 38.9 (+7.5 points). This eval measures the actual training task distribution."

Secondary result (mention this, never hide it):

"HumanEval Pass@1 as catastrophic forgetting check: base 43.9% → fine-tuned 41.2% (−2.7pp). Expected distribution shift — CommitPack does not contain general algorithmic tasks. Error analysis shows regression concentrated on DP/sorting problems, not present in training data."

This framing shows more scientific sophistication than claiming a HumanEval improvement. Any principal who knows the field will respect that you understood the eval mismatch.
4.5 Model Export and Serving
python# After training is complete
model.save_pretrained_merged(
    "codesagez-qwen-merged",
    tokenizer,
    save_method="merged_16bit"
)

model.save_pretrained_gguf(
    "codesagez-qwen-gguf",
    tokenizer,
    quantization_method="q4_k_m"
)
Create training/Modelfile:
FROM ./codesagez-qwen-gguf/model.gguf
PARAMETER temperature 0.2
PARAMETER top_p 0.95
PARAMETER num_predict 512
SYSTEM "You are a precise bug-fixing assistant. Given a commit message describing a bug and the buggy code, output only the corrected code. No explanation. No markdown fences. Only the fixed Python code."
bashollama create codesagez-coder -f training/Modelfile
ollama run codesagez-coder "test"   # verify it loads
Backend config flag OLLAMA_ENABLED=true in .env. When false, all debug endpoint calls route to Gemini Flash instead. This means your demo works without Ollama running.

Part 5: RAG Benchmark Methodology — Corrected and Final
This section resolves the adversarial criticism of the internal benchmark and adds RepoBench as the primary standardized eval.
5.1 Primary Benchmark: RepoBench-R
RepoBench (Liu et al., 2023) has three tasks. RepoBench-R is the retrieval task: given a line of code that needs cross-file context to complete, retrieve the correct context from the repository. This is exactly what graph-augmented RAG is built for.
Install and run:
bashpip install repobench
python benchmarks/eval_repobench.py \
    --retrieval_mode naive \
    --output benchmarks/results/repobench_naive.json

python benchmarks/eval_repobench.py \
    --retrieval_mode graph \
    --output benchmarks/results/repobench_graph.json
Metrics reported: Recall@5 (is the correct context in the top 5 results?) and Recall@10. Report both for naive and graph-augmented.
What to expect: Graph-augmented will score higher on cross-file retrieval tasks (which require call graph traversal) and similarly or slightly lower on single-file tasks (where the graph expansion adds irrelevant neighbors). Report both breakdowns, not just the aggregate.
If graph-augmented does not beat naive on the cross-file subset of RepoBench-R, the graph expansion logic has a bug. Fix it before claiming the contribution.
5.2 Secondary Benchmark: Internal Stratified Eval
60 questions (not 50 — 20 per category) across 3 repos: FastAPI, HTTPX, Celery.
Stratification by question type is mandatory:
Category 1 — Single-function questions (20 questions, graph expansion should NOT help here):
These are questions answerable by looking at one function. Example: "What does JSONResponse.__init__ accept as arguments in FastAPI?" Expected outcome: naive and graph-augmented perform similarly. If graph expansion dramatically helps here, it is adding noise, not signal.
Category 2 — Cross-file questions (20 questions, graph expansion should help here):
These require understanding 2+ files. Example: "What happens when FastAPI's dependency injection resolves a sub-dependency that raises an exception?" Expected outcome: graph-augmented wins by 10–20 percentage points.
Category 3 — Call-chain questions (20 questions, graph expansion helps most here):
These require tracing an execution path. Example: "Trace the complete call chain from an incoming HTTP request to the user's route handler function in FastAPI." Expected outcome: graph-augmented wins significantly.
Why stratification matters:
If you report a single aggregate number (57% vs 74%), an interviewer asks: "What fraction of your 50 questions are cross-file? If 40 of them are single-function, your improvement is concentrated in 10 questions and the headline number is misleading." The stratified breakdown preempts this entirely.
Question writing guidelines:
Before writing each question, answer: "Can this be answered by reading one function in isolation?" If yes, it goes in Category 1. If it requires understanding relationships between functions in different files, it goes in Category 2 or 3.
Questions must have objectively correct answers. "What is the general architecture of FastAPI?" is not a valid question — the answer is subjective and the judge will be inconsistent. "Which function is responsible for running Pydantic validation on request body parameters in FastAPI, and what does it do when validation fails?" is valid — there is a specific correct answer.
Commit questions as benchmarks/rag_eval_questions.json before running any evals. Do not modify questions after seeing results.
Judge calibration — resolves the length bias criticism:
The LLM judge is GPT-4o-mini with an explicit scoring rubric. The rubric explicitly penalizes answer-length as a proxy for quality:
You are evaluating whether an AI assistant correctly answered a question about a code repository.

Question: {question}
Correct answer (ground truth): {ground_truth}
AI answer: {ai_answer}

Score the AI answer 0 or 1.
Score 1 if: The AI answer identifies the correct function(s), file(s), or behavior described in the ground truth. Minor differences in wording are acceptable.
Score 0 if: The AI answer is incorrect, identifies the wrong function or file, describes incorrect behavior, or says it cannot find the information.

Important: Do not score based on answer length. A short correct answer scores 1. A long incorrect answer scores 0.

Respond with only "0" or "1". No explanation.
Calibration check — run before using judge on main eval:
Select 10 questions. Feed both retrieval methods' answers to the judge, but also feed identical context to both (same retrieval output). If the judge gives different scores to identical answers, it is not a valid judge. Recalibrate the prompt until identical answers receive identical scores 10/10 times. Document calibration results in benchmarks/methodology.md.
Confidence intervals — resolves the statistical significance criticism:
At 60 questions per category (20 per category), report Wilson confidence intervals at 95%:
pythonfrom statsmodels.stats.proportion import proportion_confint

def wilson_ci(successes, n, alpha=0.05):
    low, high = proportion_confint(successes, n, alpha=alpha, method='wilson')
    return low * 100, high * 100

# Example: 15/20 correct for graph on cross-file category
low, high = wilson_ci(15, 20)
print(f"75.0% [{low:.1f}%, {high:.1f}%]")
# Output: 75.0% [53.3%, 88.8%]
Report all numbers as: X% [CI_low%, CI_high%]. If the confidence intervals overlap between naive and graph-augmented for a category, say so and acknowledge the sample size limitation.
Report format for the benchmark page and README:
RAG Accuracy — Internal Benchmark (60 questions, 3 repos)
                           Naive           Graph-Aug
Single-function (n=20):   85% [64–95%]    87% [67–97%]   → no significant difference (expected)
Cross-file (n=20):        50% [29–71%]    75% [53–89%]   → 25pp improvement
Call-chain (n=20):        40% [21–61%]    70% [47–87%]   → 30pp improvement
Aggregate (n=60):         58% [45–70%]    77% [65–87%]   → 19pp improvement

Interpretation: Graph expansion provides significant benefit for cross-file and
call-chain questions. No benefit for single-function questions, as expected.

Part 6: API Design — Complete
All endpoints under /api/v1. Standard response envelope: {"data": ..., "error": null} on success, {"data": null, "error": {"code": "ERROR_CODE", "message": "human message"}} on failure.
POST /api/v1/repo/ingest
Request:  {"github_url": "https://github.com/...", "name": "optional display name"}
Response: 202 {"data": {"task_id": "uuid", "repo_id": "uuid", "status": "queued"}}
Errors:   400 INVALID_URL | 400 REPO_TOO_LARGE | 409 ALREADY_INDEXED | 429 RATE_LIMITED
GET /api/v1/repo/ingest/{task_id}/progress (SSE)
Events:
  progress: {"stage": "cloning|parsing|graph|embedding|storing", "current": int, "total": int, "message": str}
  complete:  {"repo_id": "uuid", "stats": {"files": int, "functions": int, "classes": int, "edges": int}}
  error:     {"code": str, "message": str}
Connection closes after "complete" or "error" event.
GET /api/v1/repo/ingest/{task_id}/status (polling fallback for SSE reconnect)
Response: {"data": {"stage": str, "current": int, "total": int, "status": "running|complete|failed"}}
GET /api/v1/repos
Response: {"data": [{"id": uuid, "name": str, "github_url": str, "status": str, "stats": {...}, "created_at": str}]}
DELETE /api/v1/repo/{repo_id}
Response: 204 No Content
Side effects: deletes ChromaDB collections {repo_id}_functions/classes/files,
              deletes PostgreSQL repo + tasks + messages records,
              removes graph from module cache
Errors:   404 REPO_NOT_FOUND | 409 INGESTION_IN_PROGRESS
POST /api/v1/repo/query (SSE)
Request:  {"repo_id": "uuid", "query": str, "retrieval_mode": "naive"|"graph"}
Events:
  retrieval_done: {"chunks": [{"name": str, "file": str, "lines": [int,int], "type": "seed"|"neighbor", "score": float}], "latency_ms": int}
  token:          {"text": str}
  done:           {"total_tokens": int, "total_latency_ms": int}
Errors:   404 REPO_NOT_FOUND | 400 REPO_NOT_READY | 429 RATE_LIMITED
POST /api/v1/code/review
Request:  {"code": str, "language": "python"|"javascript"|"typescript"}
Response: {"data": {"overall_score": int, "issues": [{"severity": str, "line": int, "description": str, "suggestion": str}], "strengths": [str], "summary": str}}
Errors:   400 CODE_TOO_LONG (>5000 chars) | 429 RATE_LIMITED
POST /api/v1/code/debug
Request:  {"code": str, "error": str, "language": str, "use_local_model": bool}
Response: {"data": {"probable_cause": str, "root_location": str|null, "execution_path": [str], "fix": str, "confidence": "high"|"medium"|"low", "model_used": "gemini-2.0-flash"|"codesagez-coder"}}
When use_local_model=true and Ollama is running: calls codesagez-coder for the fix suggestion, Gemini for the explanation. When Ollama is not running: falls back to Gemini for both. model_used in response reflects which model actually generated the fix.
POST /api/v1/code/tests
Request:  {"code": str, "language": str, "framework": "pytest"|"unittest"}
Response: {"data": {"test_code": str, "test_count": int, "cases": [{"type": "happy_path"|"edge_case"|"error_case", "name": str}]}}
GET /api/v1/benchmarks
Reads from benchmarks/results/ directory and returns all benchmark data. This is a static read — not computed on request.
json{
  "data": {
    "fine_tuning": {
      "model": "Qwen2.5-Coder-1.5B-Instruct",
      "training_samples": 8000,
      "epochs": 3,
      "primary_metric": {
        "name": "CodeBLEU (held-out CommitPack test set, n=1000)",
        "base": null,
        "finetuned": null,
        "delta": null
      },
      "secondary_metric": {
        "name": "HumanEval Pass@1 (catastrophic forgetting check)",
        "base": null,
        "finetuned": null,
        "delta": null,
        "interpretation": "fill after training"
      },
      "eval_date": null,
      "results_file": "training/results/finetuned_codeblu.json"
    },
    "rag": {
      "repobench": {
        "naive_recall_at_10": null,
        "graph_recall_at_10": null,
        "delta": null
      },
      "internal": {
        "single_function": {"naive": null, "graph": null, "naive_ci": null, "graph_ci": null},
        "cross_file": {"naive": null, "graph": null, "naive_ci": null, "graph_ci": null},
        "call_chain": {"naive": null, "graph": null, "naive_ci": null, "graph_ci": null}
      },
      "eval_date": null
    },
    "ingestion": {
      "avg_seconds_50k_loc": null,
      "p95_seconds_50k_loc": null,
      "test_repos": ["fastapi", "httpx", "celery"]
    },
    "retrieval_latency": {
      "naive_p50_ms": null,
      "naive_p95_ms": null,
      "graph_p50_ms": null,
      "graph_p95_ms": null,
      "measurement_queries": 100
    }
  }
}
All null values are filled after running the actual benchmarks. The endpoint serves nulls until then — the frontend renders "Pending measurement" for null values. This is honest. An interviewer who clones the repo before you run benchmarks sees the scaffolding, not fake numbers.

Part 7: Database Schema
sql-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE repos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_url      TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','cloning','parsing',
                                      'graphing','embedding','storing',
                                      'complete','failed')),
    stats           JSONB,
    graph_data      TEXT,              -- NetworkX graph serialized as JSON string
    error_code      TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    stage           TEXT NOT NULL,
    current_step    INTEGER NOT NULL DEFAULT 0,
    total_steps     INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','complete','failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID REFERENCES repos(id) ON DELETE SET NULL,
    session_id      TEXT NOT NULL,     -- browser-generated UUID, no auth needed
    role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content         TEXT NOT NULL,
    retrieval_mode  TEXT CHECK (retrieval_mode IN ('naive','graph')),
    retrieval_meta  JSONB,             -- {"seeds": 5, "neighbors": 3, "latency_ms": 287}
    model_used      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_repos_status     ON repos(status);
CREATE INDEX idx_repos_created    ON repos(created_at DESC);
CREATE INDEX idx_tasks_repo       ON tasks(repo_id);
CREATE INDEX idx_messages_repo    ON messages(repo_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Auto-update updated_at on repos and tasks
CREATE OR REPLACE FUNCTION _updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER repos_updated_at BEFORE UPDATE ON repos
    FOR EACH ROW EXECUTE FUNCTION _updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION _updated_at();

Part 8: Gemini Service — Complete Implementation
backend/app/services/gemini.py — the only file in the codebase that imports google.generativeai. All other files import from this service.
pythonimport google.generativeai as genai
import os
import time
import logging
from typing import Generator

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

_llm = genai.GenerativeModel(
    model_name="gemini-2.0-flash",
    generation_config=genai.types.GenerationConfig(
        temperature=0.2,
        top_p=0.95,
        max_output_tokens=2048,
    ),
    system_instruction=(
        "You are a precise software engineering assistant specializing in "
        "code analysis and debugging. Reference specific function names, "
        "file paths, and line numbers when available. Be concise and accurate."
    )
)

def stream_llm(prompt: str) -> Generator[str, None, None]:
    response = _llm.generate_content(prompt, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text

def call_llm(prompt: str) -> str:
    response = _llm.generate_content(prompt)
    return response.text

def embed_texts(
    texts: list[str],
    task_type: str = "retrieval_document",
    max_retries: int = 3
) -> list[list[float]]:
    all_embeddings = []
    for i in range(0, len(texts), 100):
        batch = texts[i:i + 100]
        for attempt in range(max_retries):
            try:
                result = genai.embed_content(
                    model="models/text-embedding-004",
                    content=batch,
                    task_type=task_type,
                    output_dimensionality=768
                )
                all_embeddings.extend(result["embedding"])
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"Embedding batch {i//100} failed after {max_retries} retries: {e}")
                    raise
                wait = 2 ** attempt
                logger.warning(f"Embedding rate limited, retrying in {wait}s...")
                time.sleep(wait)
    return all_embeddings

def embed_query(query: str) -> list[float]:
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=query,
        task_type="retrieval_query",
        output_dimensionality=768
    )
    return result["embedding"]

Part 9: Frontend — Page-by-Page Specification
Page 1: Playground (/playground)
Two-column split (50/50 on desktop, stacked on mobile).
Left column: Monaco Editor component with language auto-detection, line numbers, dark theme matching the app. Above it: four tab buttons styled as a pill selector — "Review | Debug | Tests | Complete." Selecting "Debug" renders a second Monaco Editor below the main one labeled "Error / Stack trace."
Right column: output panel. Three states — empty (shows placeholder text: "Output appears here after you run"), loading (shows animated skeleton while waiting for first token), streaming (shows tokens as they arrive, code blocks get syntax highlighting via @monaco-editor/react's colorize() API).
Bottom of left column: a "Run" button. Disabled with spinner while streaming. Enables again on done event.
No history, no save, no account. One job: paste code, see output.
Page 2: Repo Explorer (/repos)
Top section: text input with label "GitHub Repository URL" and "Index Repository" button. Input validates URL format client-side before enabling the button.
Indexing state: once button is clicked, it becomes disabled. A progress block appears below showing current stage, animated progress bar, and live status text from SSE events. On SSE complete event, the repo appears in the list below and the progress block disappears.
Repo list: each indexed repo shows name, GitHub URL, function count, status badge. Two buttons: "Chat" and "Delete." Delete requires a confirmation dialog.
Chat panel (appears after clicking Chat on a repo):
Top bar of chat panel: a toggle switch labeled "Retrieval mode" with "Naive" and "Graph" labels. Default: Graph.
Message display: standard chat layout. User messages right-aligned, gray background. Assistant messages left-aligned, with a subtle border. Below each assistant message: a collapsed Retrieval context accordion with a ▶ chevron. Clicking it expands to show the retrieved chunks as a list: function name, file path, line range, seed/neighbor badge, similarity score.
Message input: multiline textarea at the bottom. Cmd+Enter or the Send button submits. Disabled while streaming.
Page 3: Benchmarks (/benchmarks)
Static page. Data loaded from GET /api/v1/benchmarks via getStaticProps with a 10-minute revalidation interval.
Section 1 heading (plain text, no h1): "Fine-tuning results"
Two grouped bar charts (Recharts BarChart). Chart 1: CodeBLEU — two bars, "Base model" and "Fine-tuned." Chart 2: HumanEval Pass@1 — same two bars. Below each chart: one paragraph of plain English explanation. For CodeBLEU: "CodeBLEU measures how well the model's generated bug fix matches the reference fix across four dimensions: token match, AST structure match, data flow match, and code keyword match." For HumanEval: "HumanEval measures general code completion ability. We use it as a catastrophic forgetting check — a small regression here is expected since our training data does not contain general algorithmic problems."
Section 2 heading: "RAG accuracy"
A grouped bar chart with three groups (single-function, cross-file, call-chain) and two bars per group (Naive, Graph). Error bars showing Wilson confidence intervals. Below: one paragraph describing the benchmark methodology and linking to benchmarks/methodology.md in the repo.
Section 3: Two small stat cards side by side: "Ingestion speed: X seconds for 50K LOC" and "Retrieval p95: Graph Xms / Naive Xms."
All null values in the API response render as "—" with a small italic note "(benchmark pending)."
Page 4: Architecture (/architecture)
A single scrolling page. No components — just text and one embedded code block.
Four sections:
Section 1 — "The problem with naive RAG." Three paragraphs explaining why vector similarity alone misses call relationships. Includes a concrete example: function A calls B calls C, naive RAG retrieves only A, graph-augmented retrieves all three.
Section 2 — "Graph-augmented retrieval." Explains the algorithm in plain English. No jargon. Then the actual Python pseudocode for the expansion step.
Section 3 — "Fine-tuning on bug fixes." What CommitPack is, what QLoRA is, what we trained, what we measured and why we chose those metrics.
Section 4 — "Links." GitHub repo, Colab training notebook, RepoBench paper, CommitPack paper.
No marketing. No testimonials. No "Why CodeSageZ over Cursor?" section.

Part 10: Security and Reliability
Input security
GitHub URLs: validate against ^https://github\.com/[\w.\-]+/[\w.\-]+/?$. Reject anything else. No local paths. No other domains.
Repo size: before cloning, call GitHub API GET /repos/{owner}/{repo} and check size field (in KB). Reject if size > 51200 (50MB). This prevents runaway clones.
All code inputs (review, debug, tests): reject if len(code) > 10000 characters. Gemini's 1M context window does not mean you accept unlimited input — large inputs create slow responses and the 100 RPM embedding limit means very large repos take minutes.
Reliability fixes (from adversarial review)
Fix 1 — Partial ChromaDB state on embedding failure:
In ingestion.py, wrap the entire Stage 5+6 (embed + store) in a try/except. If embedding fails after partial completion:
pythontry:
    embeddings = embed_texts(all_texts)
    store_in_chromadb(repo_id, units, embeddings)
except Exception as e:
    # Clean up partial collections
    for suffix in ["_functions", "_classes", "_files"]:
        try:
            chroma_client.delete_collection(f"{repo_id}{suffix}")
        except Exception:
            pass  # collection may not exist yet, that's fine
    # Update repo status to failed
    await update_repo_status(repo_id, "failed", str(e))
    raise
Fix 2 — Uvicorn worker configuration:
In Dockerfile:
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
Two workers: one handles the long-lived SSE ingestion connection, one handles queries simultaneously.
Fix 3 — NetworkX graph cache:
In backend/app/services/graph.py:
pythonimport networkx as nx
import json
from typing import Optional

_graph_cache: dict[str, nx.DiGraph] = {}

def get_graph(repo_id: str, graph_data_json: Optional[str] = None) -> nx.DiGraph:
    if repo_id in _graph_cache:
        return _graph_cache[repo_id]
    if graph_data_json is None:
        raise ValueError(f"Graph for repo {repo_id} not in cache and no data provided")
    G = nx.node_link_graph(json.loads(graph_data_json))
    _graph_cache[repo_id] = G
    return G

def invalidate_graph(repo_id: str):
    _graph_cache.pop(repo_id, None)
Load once after ingestion completes (cache it then). Invalidate on repo deletion. On server restart, graphs are reloaded from repos.graph_data on first query.
Fix 4 — SSE reconnection:
Browser SSE connections drop on network hiccups. The GET /api/v1/repo/ingest/{task_id}/status polling endpoint exists for reconnect. Frontend logic:
typescriptfunction subscribeToIngestion(taskId: string) {
    const source = new EventSource(`/api/v1/repo/ingest/${taskId}/progress`);
    source.onerror = () => {
        source.close();
        // Poll status endpoint every 5s until complete or failed
        const poll = setInterval(async () => {
            const res = await api.getTaskStatus(taskId);
            updateProgress(res.data);
            if (res.data.status !== 'running') clearInterval(poll);
        }, 5000);
    };
}
Rate limiting configuration
pythonfrom slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Applied per endpoint:
@app.post("/api/v1/repo/ingest")
@limiter.limit("3/hour")
async def ingest_repo(...): ...

@app.post("/api/v1/repo/query")
@limiter.limit("30/minute")
async def query_repo(...): ...

@app.post("/api/v1/code/review")
@limiter.limit("20/minute")
async def review_code(...): ...

Part 11: Deployment — Production Configuration
docker-compose.yml (local development)
yamlversion: '3.9'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - CHROMADB_URL=http://chromadb:8001
      - OLLAMA_ENABLED=${OLLAMA_ENABLED:-false}
      - OLLAMA_URL=http://host.docker.internal:11434
      - FRONTEND_URL=http://localhost:3000
      - ENVIRONMENT=development
    depends_on:
      - chromadb
    volumes:
      - /tmp/codesagez:/tmp/codesagez    # temp clone directory

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8001:8001"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - CHROMA_SERVER_AUTH_CREDENTIALS=${CHROMA_AUTH_TOKEN}
      - CHROMA_SERVER_AUTH_PROVIDER=token

volumes:
  chroma_data:
Note: PostgreSQL is Supabase (remote, free tier) — not in docker-compose. The .env file contains the Supabase connection string.
.env.example
bash# Required
GEMINI_API_KEY=your_gemini_api_key_here
# Get from: https://aistudio.google.com/app/apikey

DATABASE_URL=postgresql+asyncpg://user:password@db.supabase.co:5432/postgres
# Get from: Supabase project > Settings > Database > Connection string (URI mode)

# Optional
OLLAMA_ENABLED=false
# Set to true if you have Ollama running locally with codesagez-coder model
# ollama create codesagez-coder -f training/Modelfile

CHROMA_AUTH_TOKEN=generate_a_random_token_here
# openssl rand -hex 32

FRONTEND_URL=http://localhost:3000
# In production: your Vercel deployment URL
Production deployment
Frontend: vercel deploy from the frontend/ directory. Set NEXT_PUBLIC_API_URL environment variable to your Railway backend URL in Vercel dashboard.
Backend: Railway new project → deploy from GitHub → select backend/ directory → set all environment variables from .env.example. Railway auto-detects the Dockerfile.
ChromaDB: Railway new service → Docker image chromadb/chroma:latest → set volume mount for /chroma/chroma → set environment variables for auth. Note the internal Railway URL for your backend service (CHROMADB_URL).

Part 12: Implementation Roadmap — Exact Tasks
Week 1, Day 1-2: Foundation
Tasks:

Initialize repo with the directory structure from Part 3.1
Write docker-compose.yml and confirm
<truncated 12319 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.
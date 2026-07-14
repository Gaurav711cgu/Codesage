export default function ArchitecturePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-12 text-sm leading-relaxed">

      {/* Section 1 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          The problem with naive RAG
        </h2>
        <p className="text-muted-foreground">
          Most coding assistants chunk source files into text, embed those chunks,
          and retrieve by cosine similarity. For single-function lookups, this works
          well enough. For cross-file questions it fails because code has structural
          relationships that pure embedding ignores.
        </p>
        <p className="text-muted-foreground">
          Consider a three-function chain:{" "}
          <code className="text-foreground bg-muted px-1 rounded text-xs">authenticate()</code>{" "}
          calls{" "}
          <code className="text-foreground bg-muted px-1 rounded text-xs">validate_token()</code>{" "}
          which calls{" "}
          <code className="text-foreground bg-muted px-1 rounded text-xs">decode_jwt()</code>.
          If you ask "What happens when a JWT is malformed?", a naive retriever
          returns only the chunk most similar to your query — probably{" "}
          <code className="text-foreground bg-muted px-1 rounded text-xs">decode_jwt()</code>.
          The LLM never sees the callers, so it cannot describe the error propagation
          path or the HTTP response code returned to the client.
        </p>
        <p className="text-muted-foreground">
          Graph-augmented retrieval solves this by expanding seed results along the
          call graph before passing context to the model.
        </p>
      </section>

      {/* Section 2 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Graph-augmented retrieval
        </h2>
        <p className="text-muted-foreground">
          During ingestion, Tree-sitter parses every Python file and extracts
          functions, classes, and the call references between them. These relationships
          are stored as a directed NetworkX graph where an edge from A to B means
          &quot;A calls B&quot;. The graph is serialised to PostgreSQL and cached
          in memory after first load.
        </p>
        <p className="text-muted-foreground">
          At query time, the standard vector search returns the top-5 most similar
          functions (seed nodes). Graph-augmented mode then expands each seed by one
          hop: it retrieves all successors (functions the seed calls) and all
          predecessors (functions that call the seed). These neighbours are fetched
          from ChromaDB by ID without a second vector search.
        </p>
        <p className="text-muted-foreground">
          All chunks are re-scored with a weighted formula before the top-8 are
          passed to the model:
        </p>
        <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto">
          <code>{`# Seed nodes (vector match)
final_score = 0.6 × vector_similarity + 0.4 × 1.0

# Neighbour nodes (graph expansion)
final_score = 0.6 × 0.0             + 0.4 × 0.5`}</code>
        </pre>
        <p className="text-muted-foreground">
          The 0.6/0.4 split weights semantic relevance higher than structural
          proximity, while ensuring that direct callers and callees are always
          included even when their embedding similarity is low. A seed with
          similarity 0.5 scores 0.70, comfortably above any plain neighbour (0.20),
          so seeds always rank above neighbours in the final list.
        </p>
        <p className="text-muted-foreground">
          The expansion is limited to 1 hop. A 2-hop ablation on 20 internal
          benchmark questions showed a 3-point accuracy drop versus 1-hop, because
          second-hop neighbours introduce noise that the LLM context window cannot
          absorb without hurting answer quality. Results are in{" "}
          <code className="text-foreground bg-muted px-1 rounded text-xs">
            benchmarks/results/hop_ablation.json
          </code>.
        </p>
      </section>

      {/* Section 3 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Fine-tuning on bug fixes
        </h2>
        <p className="text-muted-foreground">
          CommitPack is a large dataset of GitHub commits with their diff. We filter
          the Python split to bug-fix commits using keyword matching on commit
          messages, then apply six additional quality filters: minimum message length,
          file size caps to stay within training context windows, syntax validity
          checks on both old and new code, and a 30-line diff cap to keep only
          surgical fixes.
        </p>
        <p className="text-muted-foreground">
          After filtering, 10,000 samples are sampled with a fixed seed, split
          8,000/1,000/1,000 for train/val/test. The test split is committed to the
          repository before training begins and never examined until final evaluation.
        </p>
        <p className="text-muted-foreground">
          Fine-tuning uses QLoRA (4-bit quantised base weights, LoRA rank 16) via
          Unsloth on a Colab A100. The training objective is next-token prediction
          on the Alpaca-style prompt format:
        </p>
        <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto">
          <code>{`### Task: Fix the bug described by the commit message.

### Commit message:
<message>

### Buggy code:
\`\`\`python
<old_contents>
\`\`\`

### Fixed code:
\`\`\`python
<new_contents>    ← model learns to complete this
\`\`\``}</code>
        </pre>
        <p className="text-muted-foreground">
          The primary evaluation metric is CodeBLEU on the held-out test set.
          CodeBLEU is appropriate because it measures the actual task: generating
          a diff-like fix that matches a reference. HumanEval is run as a
          catastrophic forgetting check — a small regression is expected and does
          not indicate a training failure.
        </p>
        <p className="text-muted-foreground">
          After training, the model is exported to GGUF format and loaded into
          Ollama for local serving. The backend falls back to Gemini Flash
          automatically when Ollama is not running, so the demo works in cloud
          environments without a GPU.
        </p>
      </section>

      {/* Section 4 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Links</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li>
            GitHub:{" "}
            <a
              href="https://github.com/gauravkumarnayak/codesagez"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              gauravkumarnayak/codesagez
            </a>
          </li>
          <li>
            RepoBench paper:{" "}
            <a
              href="https://arxiv.org/abs/2306.03091"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              arxiv.org/abs/2306.03091
            </a>
          </li>
          <li>
            CommitPack paper:{" "}
            <a
              href="https://arxiv.org/abs/2308.07124"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              arxiv.org/abs/2308.07124
            </a>
          </li>
          <li>
            Qwen2.5-Coder:{" "}
            <a
              href="https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

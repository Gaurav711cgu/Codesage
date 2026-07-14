import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20">
      <h1 className="text-3xl font-semibold text-foreground mb-4">
        Graph-Augmented Code Intelligence
      </h1>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        CodeSageZ exploits source-code structure at retrieval time. When you ask
        about a function, the system automatically retrieves its callees and
        callers alongside the direct match — graph-augmented RAG, measurably
        better than naive chunking on cross-file questions.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/repos"
          className="block p-5 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
        >
          <div className="font-medium text-foreground mb-1">Repo Explorer</div>
          <div className="text-sm text-muted-foreground">
            Index a GitHub repository and ask cross-file questions.
          </div>
        </Link>
        <Link
          href="/playground"
          className="block p-5 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
        >
          <div className="font-medium text-foreground mb-1">Playground</div>
          <div className="text-sm text-muted-foreground">
            Review, debug, or generate tests for any code snippet.
          </div>
        </Link>
        <Link
          href="/benchmarks"
          className="block p-5 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
        >
          <div className="font-medium text-foreground mb-1">Benchmarks</div>
          <div className="text-sm text-muted-foreground">
            CodeBLEU, HumanEval, RepoBench-R, and internal stratified eval.
          </div>
        </Link>
        <Link
          href="/architecture"
          className="block p-5 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
        >
          <div className="font-medium text-foreground mb-1">Architecture</div>
          <div className="text-sm text-muted-foreground">
            How the call graph and fine-tuned model work together.
          </div>
        </Link>
      </div>
    </div>
  );
}

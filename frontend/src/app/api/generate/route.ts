import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(req: NextRequest) {
  const { prompt, repo_id } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Empty prompt." }, { status: 400 });
  }

  let retrievedContextStr = "";
  let retrievedChunks: Array<{
    name: string;
    file: string;
    type: string;
    content?: string;
    score?: number;
  }> = [];

  // 1. Query CodeSage Graph-RAG Backend for AST & topological context
  try {
    const targetRepo = repo_id || "active_workspace";
    const ragRes = await fetch(`${BACKEND_URL}/tools/retrieve_code_context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo_id: targetRepo,
        query: prompt,
        mode: "graph",
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (ragRes.ok) {
      const ragData = await ragRes.json();
      if (Array.isArray(ragData.chunks) && ragData.chunks.length > 0) {
        retrievedChunks = ragData.chunks.slice(0, 4).map((c: any) => ({
          name: c.name || "symbol",
          file: c.file || c.file_path || "source.py",
          type: c.type || "seed",
          content: c.content || "",
          score: c.score ?? 0,
        }));

        retrievedContextStr =
          "=== CodeSage 2-Hop Graph-RAG Context ===\n" +
          ragData.chunks
            .slice(0, 4)
            .map(
              (c: any, i: number) =>
                `[${i + 1}] ${c.file || c.file_path} (${c.name}) [${c.type}]:\n${c.content || ""}`
            )
            .join("\n\n");
      }
    }
  } catch (_e) {
    // If backend is offline, proceed with zero-shot LLM generation
  }

  // 2. Direct Gemini Call (Augmented with Graph-RAG context if available)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const promptContent = retrievedContextStr
    ? `${retrievedContextStr}\n\n=== User Query ===\n${prompt}`
    : prompt;

  const body = {
    system_instruction: {
      parts: [
        {
          text:
            "You are CodeSage, an architectural code intelligence assistant specializing in Python, TypeScript, and systems engineering. " +
            "When retrieved context is provided, ground your answer in the specific functions, interfaces, and call relationships given. " +
            "Keep explanations concise, rigorous, and technical. Format code in markdown code blocks.",
        },
      ],
    },
    contents: [{ role: "user", parts: [{ text: promptContent }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Gemini API error (${res.status}): ${err}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no response)";

    return NextResponse.json({
      result: text,
      retrieved_chunks: retrievedChunks,
      rag_augmented: retrievedChunks.length > 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

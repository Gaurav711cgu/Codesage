import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Empty prompt." }, { status: 400 });
  }

  // 1. Try FastAPI Backend First (CodeSageZ RAG / Code Intelligence Engine)
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/v1/code/debug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.API_KEY ? { "X-API-Key": process.env.API_KEY } : {}),
      },
      body: JSON.stringify({
        code: prompt,
        error_message: "Optimize and review code structure",
        language: "python",
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (backendRes.ok) {
      const bData = await backendRes.json();
      if (bData.data?.fixed_code || bData.data?.explanation) {
        const out = `### CodeSage Analysis\n${bData.data.explanation}\n\n\`\`\`python\n${bData.data.fixed_code}\n\`\`\``;
        return NextResponse.json({ result: out });
      }
    }
  } catch (_e) {
    // Fall back to direct Gemini call if backend is offline
  }

  // 2. Direct Gemini Call Fallback
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const body = {
    system_instruction: {
      parts: [
        {
          text:
            "You are CodeSage, an expert coding assistant specialising in Python, ML, and software engineering. " +
            "When asked for code, respond with clean, well-commented, working code. " +
            "Keep explanations concise. Format code in markdown code blocks.",
        },
      ],
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

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

  return NextResponse.json({ result: text });
}

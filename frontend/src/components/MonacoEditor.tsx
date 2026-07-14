"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { editor } from "monaco-editor";

// Monaco is loaded client-side only (no SSR)
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface Props {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
  label?: string;
}

export default function MonacoEditor({
  value,
  onChange,
  language = "python",
  readOnly = false,
  height = "320px",
  label,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount = (ed: editor.IStandaloneCodeEditor) => {
    editorRef.current = ed;
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </label>
      )}
      <div
        className="rounded-md overflow-hidden border border-border"
        style={{ height }}
      >
        <Editor
          height={height}
          language={language}
          value={value}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
          }}
          onChange={(v) => onChange?.(v ?? "")}
          onMount={handleMount}
        />
      </div>
    </div>
  );
}

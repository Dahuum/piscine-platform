"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@heroui/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language: "c" | "shell";
  theme?: string;
}

export default function CodeEditor({ value, onChange, language, theme }: CodeEditorProps) {
  return (
    <MonacoEditor
      height="100%"
      language={language === "shell" ? "shell" : "c"}
      value={value}
      onChange={onChange}
      theme={theme || "vs-dark"}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: false,
        wordWrap: "on",
        padding: { top: 16, bottom: 16 },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: true },
      }}
    />
  );
}

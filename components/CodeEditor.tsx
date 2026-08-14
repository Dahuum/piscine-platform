"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Skeleton } from "@heroui/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language: "c" | "shell";
}

export default function CodeEditor({ value, onChange, language }: CodeEditorProps) {
  const [theme, setTheme] = useState<"vs-dark" | "vs">("vs-dark");

  useEffect(() => {
    const update = () => {
      setTheme(document.documentElement.classList.contains("dark") ? "vs-dark" : "vs");
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <MonacoEditor
      height="100%"
      language={language === "shell" ? "shell" : "c"}
      value={value}
      onChange={onChange}
      theme={theme}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
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

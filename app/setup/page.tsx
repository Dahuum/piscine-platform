"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";

export default function SetupPage() {
  const [sql, setSql] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/db/setup")
      .then((r) => r.json())
      .then((d) => setSql(d.sql || ""))
      .catch(() => {});
  }, []);

  const copySql = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Database Setup</h1>
      <p className="text-sm text-muted-foreground mb-6">
        One-time setup to connect the app to Supabase.
      </p>

      <div className="space-y-4 mb-8">
        {[
          { num: "1", title: "Open Supabase SQL Editor", desc: "Copy the SQL below, then open the editor." },
          { num: "2", title: "Paste & Run the SQL", desc: "Creates 6 tables with Row Level Security." },
          { num: "3", title: "Enable Email Auth", desc: "Authentication → Providers → Email → Enable." },
          { num: "4", title: "Done!", desc: "Sign in on the platform — all progress syncs automatically." },
        ].map((step) => (
          <div key={step.num} className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{step.num}</span>
            </div>
            <div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-4">
        <Button variant="primary" size="sm" onPress={copySql}>
          {copied ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy SQL
            </>
          )}
        </Button>
        <a
          href="https://julmcohcipklgseecize.supabase.co/project/default/sql/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium bg-muted hover:bg-muted/70 transition-colors no-underline text-foreground"
        >
          Open SQL Editor <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <pre className="p-4 rounded-lg border bg-muted/30 text-xs font-mono overflow-x-auto whitespace-pre max-h-[60vh] overflow-y-auto scrollbar-thin">
        {sql || "Loading..."}
      </pre>
    </div>
  );
}

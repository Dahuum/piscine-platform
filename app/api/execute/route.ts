import { NextRequest, NextResponse } from "next/server";
import { executeCode } from "@/lib/sandbox";
import { modules } from "@/lib/modules";
import { getExamWeekOrNull } from "@/lib/exam-data";

// Sandbox create + compile + run comfortably fits in this, but the default
// serverless timeout (10s on Hobby) does not.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { code, exerciseId, moduleId } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    if (moduleId && moduleId.startsWith("exam_")) {
      const week = getExamWeekOrNull(moduleId);
      if (!week) {
        return NextResponse.json({ error: "Unknown exam week" }, { status: 400 });
      }
      const output = await executeCode(code, "c");
      return NextResponse.json({ output });
    }

    if (!moduleId) {
      return NextResponse.json({ error: "Missing moduleId" }, { status: 400 });
    }

    const mod = modules[moduleId as keyof typeof modules];
    if (!mod) {
      return NextResponse.json({ error: "Unknown module" }, { status: 400 });
    }

    const output = await executeCode(code, mod.type as "c" | "shell");
    return NextResponse.json({ output });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Execute error:", error);
    return NextResponse.json({ output: `Error: ${message}`, error: message }, { status: 200 });
  }
}

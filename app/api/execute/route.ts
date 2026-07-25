import { NextRequest, NextResponse } from "next/server";
import { executeCode } from "@/lib/sandbox";
import { modules } from "@/lib/modules";

export async function POST(req: NextRequest) {
  try {
    const { code, exerciseId, moduleId } = await req.json();

    if (!code || !moduleId) {
      return NextResponse.json({ error: "Missing code or moduleId" }, { status: 400 });
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

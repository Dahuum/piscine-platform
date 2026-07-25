const WANDBOX = "https://wandbox.org/api/compile.json";

export async function executeCode(code: string, type: "c" | "shell"): Promise<string> {
  const compiler = type === "shell" ? "bash" : "gcc-head";

  try {
    const res = await fetch(WANDBOX, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler,
        code,
        "compiler-option-raw": type === "c" ? "-Wall -Wextra -Werror" : "",
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      return `Error: API returned ${res.status}`;
    }

    const data = await res.json();

    if (data.compiler_error || data.compiler_output) {
      return `Compilation failed:\n${data.compiler_error || ""}${data.compiler_output || ""}`;
    }

    if (data.program_error) {
      return `Runtime error:\n${data.program_error}`;
    }

    const output = data.program_output || data.program_message || "";
    return output || "(no output)";
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Execution error: ${msg}`;
  }
}

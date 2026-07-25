import { Sandbox } from "e2b";

export async function executeCode(code: string, type: "c" | "shell"): Promise<string> {
  const E2B_API_KEY = process.env.E2B_API_KEY;

  if (!E2B_API_KEY) {
    return "Error: E2B_API_KEY not configured. Set it in Vercel Environment Variables.";
  }

  let sandbox: Sandbox | undefined;

  try {
    sandbox = await Sandbox.create({
      apiKey: E2B_API_KEY,
      template: "base",
      timeoutMs: 60000,
    });

    if (type === "shell") {
      const result = await sandbox.commands.run(code, { timeoutMs: 15000 });
      return result.stdout + (result.stderr ? "\n" + result.stderr : "") || "(no output)";
    }

    const filePath = "/home/user/solution.c";
    await sandbox.files.write(filePath, code);

    const compileResult = await sandbox.commands.run(
      `cc -Wall -Wextra -Werror ${filePath} -o /home/user/a.out 2>&1`,
      { timeoutMs: 20000 },
    );

    if (compileResult.exitCode !== 0) {
      return `Compilation failed:\n${compileResult.stderr || compileResult.stdout}`;
    }

    const warnings = compileResult.stderr || "";
    const runResult = await sandbox.commands.run("/home/user/a.out", { timeoutMs: 15000 });
    const runOutput = runResult.stdout + (runResult.stderr ? "\n" + runResult.stderr : "");

    let final = runOutput || "(no output)";
    if (warnings.trim()) {
      final = `Warnings:\n${warnings}\n---\nOutput:\n${final}`;
    }
    return final;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Execution error: ${msg}`;
  } finally {
    if (sandbox) {
      try { await sandbox.kill(); } catch { /* ignore */ }
    }
  }
}

import { Sandbox } from "e2b";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

async function executeWithE2B(code: string, type: "c" | "shell"): Promise<string> {
  const E2B_API_KEY = process.env.E2B_API_KEY!;
  const sandbox = await Sandbox.create({ apiKey: E2B_API_KEY, timeoutMs: 30000 });

  try {
    if (type === "shell") {
      const result = await sandbox.commands.run(code, { timeoutMs: 10000 });
      return result.stdout + (result.stderr ? "\n" + result.stderr : "") || "(no output)";
    }

    const filePath = "/home/user/solution.c";
    await sandbox.files.write(filePath, code);

    const compileResult = await sandbox.commands.run(
      `cc -Wall -Wextra -Werror ${filePath} -o /home/user/a.out 2>&1`,
      { timeoutMs: 15000 },
    );

    if (compileResult.exitCode !== 0) {
      return `Compilation failed:\n${compileResult.stderr || compileResult.stdout}`;
    }

    const warnings = compileResult.stderr || compileResult.stdout || "";
    const runResult = await sandbox.commands.run("/home/user/a.out", { timeoutMs: 10000 });
    const runOutput = runResult.stdout + (runResult.stderr ? "\n" + runResult.stderr : "");

    let final = runOutput || "(no output)";
    if (warnings && warnings.trim() && !warnings.includes("0 errors")) {
      final = `Warnings:\n${warnings}\n---\nOutput:\n${final}`;
    }
    return final;
  } finally {
    await sandbox.kill();
  }
}

function executeLocally(code: string, type: "c" | "shell"): string {
  const dir = tmpdir();
  const id = randomUUID();

  try {
    if (type === "shell") {
      const scriptPath = join(dir, `${id}.sh`);
      writeFileSync(scriptPath, code);
      try {
        const output = execSync(`sh "${scriptPath}"`, {
          timeout: 10000,
          encoding: "utf-8",
          cwd: dir,
        });
        return output || "(no output)";
      } catch (e: unknown) {
        const err = e as { stderr?: string; stdout?: string; message?: string };
        return err.stderr || err.stdout || err.message || "Execution error";
      } finally {
        try { unlinkSync(scriptPath); } catch { /* ignore */ }
      }
    }

    const srcPath = join(dir, `${id}.c`);
    const outPath = join(dir, `${id}.out`);
    writeFileSync(srcPath, code);

    try {
      execSync(`cc -Wall -Wextra -Werror "${srcPath}" -o "${outPath}" 2>&1`, {
        timeout: 15000,
        encoding: "utf-8",
      });
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string };
      let errOut = err.stderr || err.stdout || "";
      try { unlinkSync(srcPath); } catch { /* ignore */ }
      return `Compilation failed:\n${errOut}`;
    }

    try {
      const output = execSync(`"${outPath}"`, {
        timeout: 10000,
        encoding: "utf-8",
      });
      return output || "(no output)";
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string };
      return err.stderr || err.stdout || "Runtime error";
    } finally {
      try { unlinkSync(srcPath); unlinkSync(outPath); } catch { /* ignore */ }
    }
  } catch (e: unknown) {
    const err = e as { message?: string };
    return `Error: ${err.message || "Unknown error"}`;
  }
}

export async function executeCode(code: string, type: "c" | "shell"): Promise<string> {
  if (process.env.E2B_API_KEY) {
    try {
      return await executeWithE2B(code, type);
    } catch (e: unknown) {
      console.error("E2B failed, falling back to local execution:", e instanceof Error ? e.message : e);
    }
  }
  return executeLocally(code, type);
}

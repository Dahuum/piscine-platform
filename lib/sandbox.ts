import { Sandbox, CommandExitError } from "e2b";

export async function executeCode(code: string, type: "c" | "shell"): Promise<string> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    return "Error: E2B_API_KEY not configured";
  }

  const sandbox = await Sandbox.create({ timeoutMs: 60000 });

  try {
    await sandbox.files.write("/tmp/code.c", code);

    if (type === "shell") {
      try {
        const result = await sandbox.commands.run("bash /tmp/code.c", {
          timeoutMs: 10000,
          onStdout: () => {},
          onStderr: () => {},
        });
        return (result.stdout || "") + (result.stderr || "") || "(no output)";
      } catch (e: unknown) {
        if (e instanceof CommandExitError) {
          return `Runtime error (exit ${e.exitCode}):\n${e.stderr || e.stdout || ""}`;
        }
        throw e;
      }
    }

    try {
      await sandbox.commands.run(
        "gcc -o /tmp/a.out /tmp/code.c -Wall -Wextra -Werror",
        { timeoutMs: 20000, onStdout: () => {}, onStderr: () => {} },
      );
    } catch (e: unknown) {
      if (e instanceof CommandExitError) {
        return `Compilation failed:\n${e.stderr || e.stdout || "unknown error"}`;
      }
      throw e;
    }

    try {
      const run = await sandbox.commands.run("/tmp/a.out", {
        timeoutMs: 10000,
        onStdout: () => {},
        onStderr: () => {},
      });
      return (run.stdout || "") + (run.stderr || "") || "(no output)";
    } catch (e: unknown) {
      if (e instanceof CommandExitError) {
        return `Runtime error:\n${e.stderr || e.stdout || ""}`;
      }
      throw e;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Execution error: ${msg}`;
  } finally {
    try {
      await sandbox.kill();
    } catch {
      // sandbox may already be dead
    }
  }
}

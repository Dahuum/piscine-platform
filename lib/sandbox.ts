const E2B_API = "https://api.e2b.dev";

interface SandboxInfo {
  sandboxId: string;
  envdAccessToken: string;
}

async function createSandbox(): Promise<SandboxInfo> {
  const key = process.env.E2B_API_KEY!;
  const res = await fetch(`${E2B_API}/sandboxes`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ template: "base", timeout: 60000 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`E2B sandbox creation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return { sandboxId: data.sandboxId, envdAccessToken: data.envdAccessToken };
}

async function runCommand(
  sandboxId: string,
  token: string,
  cmd: string,
  timeoutMs = 20000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const key = process.env.E2B_API_KEY!;
  const res = await fetch(
    `${E2B_API}/sandboxes/${sandboxId}/commands`,
    {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${key}`,
        "X-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cmd, timeout: timeoutMs }),
      signal: AbortSignal.timeout(timeoutMs + 10000),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Command failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    stdout: data.stdout || "",
    stderr: data.stderr || "",
    exitCode: data.exitCode ?? 0,
  };
}

async function writeFile(sandboxId: string, token: string, path: string, content: string): Promise<void> {
  const key = process.env.E2B_API_KEY!;
  const res = await fetch(
    `${E2B_API}/sandboxes/${sandboxId}/files?path=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${key}`,
        "X-Access-Token": token,
        "Content-Type": "text/plain",
      },
      body: content,
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`File write failed: ${res.status} ${err}`);
  }
}

async function deleteSandbox(sandboxId: string, token: string): Promise<void> {
  const key = process.env.E2B_API_KEY!;
  try {
    await fetch(`${E2B_API}/sandboxes/${sandboxId}`, {
      method: "DELETE",
      headers: {
        Authorization: `ApiKey ${key}`,
        "X-Access-Token": token,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* ignore cleanup errors */ }
}

export async function executeCode(code: string, type: "c" | "shell"): Promise<string> {
  const key = process.env.E2B_API_KEY;

  if (!key) {
    return "Error: E2B_API_KEY not configured.";
  }

  let sandboxId = "";
  let token = "";

  try {
    const sandbox = await createSandbox();
    sandboxId = sandbox.sandboxId;
    token = sandbox.envdAccessToken;

    if (type === "shell") {
      const result = await runCommand(sandboxId, token, code, 15000);
      return result.stdout + (result.stderr ? "\n" + result.stderr : "") || "(no output)";
    }

    const filePath = "/home/user/solution.c";
    await writeFile(sandboxId, token, filePath, code);

    const compile = await runCommand(
      sandboxId,
      token,
      `cc -Wall -Wextra -Werror ${filePath} -o /home/user/a.out 2>&1`,
      20000,
    );

    if (compile.exitCode !== 0) {
      return `Compilation failed:\n${compile.stderr || compile.stdout}`;
    }

    const warnings = compile.stderr || "";
    const run = await runCommand(sandboxId, token, "/home/user/a.out", 15000);
    const output = run.stdout + (run.stderr ? "\n" + run.stderr : "");

    let final = output || "(no output)";
    if (warnings.trim()) {
      final = `Warnings:\n${warnings}\n---\nOutput:\n${final}`;
    }
    return final;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Execution error: ${msg}`;
  } finally {
    if (sandboxId && token) {
      await deleteSandbox(sandboxId, token);
    }
  }
}

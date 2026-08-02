import { Sandbox } from "e2b";
import type { ExamExercise } from "./exam-data";

type TestResult = {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
};

type GradeResult =
  | { passed: true }
  | {
      passed: false;
      compilationError?: string;
      results: TestResult[];
      traceback: string;
    };

async function runInSandbox(
  sandbox: Sandbox,
  cmd: string,
  timeoutMs = 5000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const result = await sandbox.commands.run(cmd, {
    timeoutMs,
    onStdout: () => {},
    onStderr: () => {},
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: result.exitCode ?? 0,
  };
}

export async function gradeSubmission(
  exercise: ExamExercise,
  studentCode: string,
): Promise<GradeResult> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    return {
      passed: false,
      compilationError: "E2B_API_KEY not configured",
      results: [],
      traceback: "INTERNAL ERROR: E2B_API_KEY not configured",
    };
  }

  const sandbox = await Sandbox.create({ timeoutMs: 120000 });

  try {
    await sandbox.files.write("/ref.c", exercise.referenceCode);
    await sandbox.files.write("/student.c", studentCode);
    if (exercise.mainCode) {
      await sandbox.files.write("/main.c", exercise.mainCode);
    }

    const refCompileCmd =
      exercise.type === "function"
        ? "gcc -o /ref /ref.c /main.c -Wall -Wextra -Werror 2>&1"
        : "gcc -o /ref /ref.c -Wall -Wextra -Werror 2>&1";

    const refCompile = await runInSandbox(sandbox, refCompileCmd);
    if (refCompile.exitCode !== 0) {
      return {
        passed: false,
        compilationError: `Reference compilation failed: ${refCompile.stderr || refCompile.stdout}`,
        results: [],
        traceback: `INTERNAL ERROR: ref compilation failed:\n${refCompile.stderr || refCompile.stdout}`,
      };
    }

    const stuCompileCmd =
      exercise.type === "function"
        ? "gcc -o /student /student.c /main.c -Wall -Wextra -Werror 2>&1"
        : "gcc -o /student /student.c -Wall -Wextra -Werror 2>&1";

    const stuCompile = await runInSandbox(sandbox, stuCompileCmd);
    if (stuCompile.exitCode !== 0) {
      const compileErr = stuCompile.stderr || stuCompile.stdout;
      return {
        passed: false,
        compilationError: compileErr,
        results: [],
        traceback: `❌ COMPILATION ERROR:\n${compileErr}`,
      };
    }

    const results: TestResult[] = [];
    for (const tc of exercise.testCases) {
      const args = tc.args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ");
      const cmdRef = `/ref ${args}`;
      const cmdStudent = `/student ${args}`;

      try {
        const refRun = await runInSandbox(sandbox, cmdRef, 5000);
        const expected = (refRun.stdout + (refRun.stderr || ""))
          .replace(/\r\n/g, "\n");
        const stuRun = await runInSandbox(sandbox, cmdStudent, 5000);
        const actual = (stuRun.stdout + (stuRun.stderr || ""))
          .replace(/\r\n/g, "\n");
        const passed = expected === actual;
        results.push({
          passed,
          input: tc.args.join(" ") || "(no args)",
          expected,
          actual,
        });
      } catch (err) {
        results.push({
          passed: false,
          input: tc.args.join(" ") || "(no args)",
          expected: "(timeout or error)",
          actual: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const allPassed = results.every((r) => r.passed);
    if (allPassed) {
      return { passed: true };
    }

    const failures = results.filter((r) => !r.passed);
    const traceback = failures
      .map(
        (r) =>
          `💻 TEST: ${r.input}\n` +
          `🔎 YOUR OUTPUT:\n${r.actual || "(empty)"}\n` +
          `🗝 EXPECTED OUTPUT:\n${r.expected || "(empty)"}`,
      )
      .join("\n----------------------------------------\n");

    return { passed: false, results, traceback };
  } finally {
    try {
      await sandbox.kill();
    } catch {
      // sandbox may already be dead
    }
  }
}

export function getCooldownSeconds(assignmentCount: number): number {
  if (assignmentCount <= 0) return 0;
  if (assignmentCount === 1) return 30;
  if (assignmentCount === 2) return 150;
  let a = 30;
  let b = 150;
  for (let i = 3; i <= assignmentCount; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}

export function formatCooldown(seconds: number): string {
  if (seconds <= 0) return "0s";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}s`;
  if (sec === 0) return `${min} min`;
  return `${min} min ${sec}s`;
}

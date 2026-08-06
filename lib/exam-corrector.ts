import { Sandbox, CommandExitError } from "e2b";
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
      // Set when the failure is ours (missing E2B key, broken reference
      // code) rather than the student's — the route uses this to skip
      // burning an attempt/cooldown on a submission that never had a fair
      // shot at passing.
      systemError?: boolean;
    };

async function runInSandbox(
  sandbox: Sandbox,
  cmd: string,
  timeoutMs = 5000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
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
  } catch (e: unknown) {
    if (e instanceof CommandExitError) {
      return {
        stdout: e.stdout || "",
        stderr: e.stderr || "",
        exitCode: e.exitCode,
      };
    }
    throw e;
  }
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
      systemError: true,
    };
  }

  const sandbox = await Sandbox.create({ timeoutMs: 120000 });

  try {
    await sandbox.files.write("/tmp/ref.c", exercise.referenceCode);
    await sandbox.files.write("/tmp/student.c", studentCode);
    if (exercise.mainCode) {
      await sandbox.files.write("/tmp/main.c", exercise.mainCode);
    }

    const refCompileCmd =
      exercise.type === "function"
        ? "gcc -o /tmp/ref /tmp/ref.c /tmp/main.c -Wall -Wextra -Werror 2>&1"
        : "gcc -o /tmp/ref /tmp/ref.c -Wall -Wextra -Werror 2>&1";

    const refCompile = await runInSandbox(sandbox, refCompileCmd);
    if (refCompile.exitCode !== 0) {
      return {
        passed: false,
        compilationError: `Reference compilation failed: ${refCompile.stderr || refCompile.stdout}`,
        results: [],
        traceback: `INTERNAL ERROR: ref compilation failed:\n${refCompile.stderr || refCompile.stdout}`,
        systemError: true,
      };
    }

    const stuCompileCmd =
      exercise.type === "function"
        ? "gcc -o /tmp/student /tmp/student.c /tmp/main.c -Wall -Wextra -Werror 2>&1"
        : "gcc -o /tmp/student /tmp/student.c -Wall -Wextra -Werror 2>&1";

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
      const cmdRef = `/tmp/ref ${args}`;
      const cmdStudent = `/tmp/student ${args}`;

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

// Compiles the student's code and runs it against the exercise's own test
// cases, without comparing to the reference — used by exam prep ("Run") to
// show the student their own output. Unlike a plain gcc-and-run, this links
// exercise.mainCode when the exercise is function-type (a bare function has
// no main() to link on its own) and actually passes each test case's args,
// so a program-type exercise isn't limited to only ever seeing its
// zero-argument behavior.
export async function runExamExercise(
  exercise: ExamExercise,
  studentCode: string,
): Promise<string> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    return "Error: E2B_API_KEY not configured";
  }

  const sandbox = await Sandbox.create({ timeoutMs: 60000 });

  try {
    await sandbox.files.write("/tmp/student.c", studentCode);
    if (exercise.mainCode) {
      await sandbox.files.write("/tmp/main.c", exercise.mainCode);
    }

    const compileCmd =
      exercise.type === "function"
        ? "gcc -o /tmp/student /tmp/student.c /tmp/main.c -Wall -Wextra -Werror 2>&1"
        : "gcc -o /tmp/student /tmp/student.c -Wall -Wextra -Werror 2>&1";

    const compile = await runInSandbox(sandbox, compileCmd);
    if (compile.exitCode !== 0) {
      return `Compilation failed:\n${compile.stderr || compile.stdout || "unknown error"}`;
    }

    if (exercise.testCases.length === 0) {
      const run = await runInSandbox(sandbox, "/tmp/student", 5000);
      return (run.stdout + (run.stderr || "")) || "(no output)";
    }

    const blocks = [];
    for (const tc of exercise.testCases) {
      const args = tc.args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ");
      const run = await runInSandbox(sandbox, `/tmp/student ${args}`, 5000);
      const out = (run.stdout + (run.stderr || "")) || "(no output)";
      const label = tc.args.length > 0 ? tc.args.join(" ") : "(no args)";
      blocks.push(`$ ./${exercise.name} ${label}\n${out}`);
    }
    return blocks.join("\n" + "-".repeat(40) + "\n");
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

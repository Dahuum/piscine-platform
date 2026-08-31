import { Sandbox, CommandExitError } from 'e2b'

export async function executeCode(code: string, type: 'c' | 'shell'): Promise<string> {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) {
    return 'Error: E2B_API_KEY not configured'
  }

  const sandbox = await Sandbox.create({ timeoutMs: 60000 })

  try {
    // Practice exercises are submitted as a bare function ("Submit only the
    // required function" — no student-written main()), but compiling that
    // alone always fails to link with "undefined reference to `main'"
    // regardless of whether the function itself is correct. That linker
    // error was showing up as "your code is broken" on every single
    // submission, correct or not. A no-op stub main() is enough to make it
    // link — the exercise still isn't exercised against real inputs here
    // (that's what the separate AI verdict is for), but a genuinely correct
    // function now compiles clean instead of always reporting a fake error.
    const hasMain = type === 'c' && /\bmain\s*\(/.test(code)
    const toWrite = type === 'c' && !hasMain ? `${code}\n\nint main(void) { return 0; }\n` : code
    await sandbox.files.write('/tmp/code.c', toWrite)

    if (type === 'shell') {
      try {
        const result = await sandbox.commands.run('bash /tmp/code.c', { timeoutMs: 10000, onStdout: () => {}, onStderr: () => {} })
        return (result.stdout || '') + (result.stderr || '') || '(no output)'
      } catch (e: unknown) {
        if (e instanceof CommandExitError) {
          return `Runtime error (exit ${e.exitCode}):\n${e.stderr || e.stdout || ''}`
        }
        throw e
      }
    }

    try {
      await sandbox.commands.run('gcc -o /tmp/a.out /tmp/code.c -Wall -Wextra -Werror', { timeoutMs: 20000, onStdout: () => {}, onStderr: () => {} })
    } catch (e: unknown) {
      if (e instanceof CommandExitError) {
        return `Compilation failed:\n${e.stderr || e.stdout || 'unknown error'}`
      }
      throw e
    }

    try {
      const run = await sandbox.commands.run('/tmp/a.out', { timeoutMs: 10000, onStdout: () => {}, onStderr: () => {} })
      return (run.stdout || '') + (run.stderr || '') || '(no output)'
    } catch (e: unknown) {
      if (e instanceof CommandExitError) {
        return `Runtime error:\n${e.stderr || e.stdout || ''}`
      }
      throw e
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return `Execution error: ${msg}`
  } finally {
    try {
      await sandbox.kill()
    } catch {
      // sandbox may already be dead
    }
  }
}

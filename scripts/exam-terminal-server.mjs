import http from "http";
import { WebSocketServer } from "ws";
import { Sandbox } from "e2b";

const PORT = 3001;
const sandboxes = new Map();

function json(o) {
  try { return JSON.stringify(o); } catch { return "{}"; }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("exam-terminal ready");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let sandbox = null;
  let ptyPid = null;

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    try {
      if (msg.type === "create") {
        sandbox = await Sandbox.create({ timeoutMs: 5 * 3600 * 1000 });
        sandboxes.set(sandbox.sandboxId, sandbox);

        await sandbox.files.makeDir("/home/user/rendu");
        await sandbox.files.write("/home/user/.bashrc", "export PS1='\\[\\e[32m\\]examshell\\[\\e[0m\\]> '\nalias ls='ls --color=auto'\n");

        const handle = await sandbox.pty.create({
          cols: msg.cols || 80,
          rows: msg.rows || 24,
          cwd: "/home/user",
          onData: (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(json({ type: "data", data: Array.from(data) }));
            }
          },
        });

        ptyPid = handle.pid;
        ws.send(json({ type: "ready", sandboxId: sandbox.sandboxId, pid: ptyPid }));
        return;
      }

      if (msg.type === "connect") {
        sandbox = sandboxes.get(msg.sandboxId);
        if (!sandbox) {
          try { sandbox = await Sandbox.connect(msg.sandboxId); } catch { ws.send(json({ type: "error", error: "sandbox not found" })); return; }
        }

        await sandbox.pty.connect(msg.pid, {
          onData: (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(json({ type: "data", data: Array.from(data) }));
            }
          },
        });

        ptyPid = msg.pid;
        ws.send(json({ type: "ready", sandboxId: sandbox.sandboxId, pid: ptyPid }));
        return;
      }

      if (msg.type === "input" && sandbox && ptyPid != null) {
        const data = new Uint8Array(msg.data);
        await sandbox.pty.sendInput(ptyPid, data);
        return;
      }

      if (msg.type === "resize" && sandbox && ptyPid != null) {
        await sandbox.pty.resize(ptyPid, { cols: msg.cols, rows: msg.rows });
        return;
      }

      if (msg.type === "grade" && sandbox) {
        const { exerciseName, referenceCode, mainCode, testCases } = msg;
        const renduPath = `/home/user/rendu/${exerciseName}`;
        let studentCode = "";
        try { studentCode = await sandbox.files.read(`${renduPath}/${exerciseName}.c`); } catch { ws.send(json({ type: "grade_result", passed: false, error: "file not found" })); return; }

        try { await sandbox.files.write("/tmp/ref.c", referenceCode); } catch {}
        try { await sandbox.files.write("/tmp/student.c", studentCode); } catch {}
        if (mainCode) try { await sandbox.files.write("/tmp/main.c", mainCode); } catch {}

        const compileRef = mainCode
          ? `gcc -o /tmp/ref /tmp/ref.c /tmp/main.c -Wall -Wextra -Werror 2>&1`
          : `gcc -o /tmp/ref /tmp/ref.c -Wall -Wextra -Werror 2>&1`;
        const refComp = await sandbox.commands.run(compileRef, { timeoutMs: 15000 });
        if (refComp.exitCode !== 0) {
          ws.send(json({ type: "grade_result", passed: false, error: `ref compilation failed: ${refComp.stderr || refComp.stdout}` }));
          return;
        }

        const compileStu = mainCode
          ? `gcc -o /tmp/student /tmp/student.c /tmp/main.c -Wall -Wextra -Werror 2>&1`
          : `gcc -o /tmp/student /tmp/student.c -Wall -Wextra -Werror 2>&1`;
        const stuComp = await sandbox.commands.run(compileStu, { timeoutMs: 15000 });
        if (stuComp.exitCode !== 0) {
          ws.send(json({ type: "grade_result", passed: false, compilationError: stuComp.stderr || stuComp.stdout }));
          return;
        }

        const failures = [];
        for (const tc of (testCases || [])) {
          const args = (tc.args || []).map(a => `"${a.replace(/"/g, '\\"')}"`).join(" ");
          try {
            const refRun = await sandbox.commands.run(`/tmp/ref ${args}`, { timeoutMs: 5000 });
            const expected = (refRun.stdout + (refRun.stderr || "")).replace(/\r\n/g, "\n");
            const stuRun = await sandbox.commands.run(`/tmp/student ${args}`, { timeoutMs: 5000 });
            const actual = (stuRun.stdout + (stuRun.stderr || "")).replace(/\r\n/g, "\n");
            if (expected !== actual) {
              failures.push({ input: tc.args.join(" ") || "(no args)", expected, actual });
            }
          } catch (e) {
            failures.push({ input: (tc.args || []).join(" ") || "(no args)", expected: "(error)", actual: String(e.message) });
          }
        }

        if (failures.length === 0) {
          ws.send(json({ type: "grade_result", passed: true }));
        } else {
          const traceback = failures.map(f =>
            `💻 TEST: ${f.input}\n🔎 YOUR OUTPUT:\n${f.actual || "(empty)"}\n🗝 EXPECTED OUTPUT:\n${f.expected || "(empty)"}`
          ).join("\n---\n");
          ws.send(json({ type: "grade_result", passed: false, traceback }));
        }
        return;
      }

      if (msg.type === "kill" && sandbox) {
        try { if (ptyPid != null) await sandbox.pty.kill(ptyPid); } catch {}
        try { await sandbox.kill(); } catch {}
        sandboxes.delete(sandbox.sandboxId);
        ws.send(json({ type: "killed" }));
        return;
      }
    } catch (e) {
      ws.send(json({ type: "error", error: e.message }));
    }
  });

  ws.on("close", () => {
    if (ptyPid != null && sandbox) {
      try { sandbox.pty.kill(ptyPid); } catch {}
    }
    if (sandbox) {
      sandboxes.delete(sandbox.sandboxId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Exam terminal relay running on ws://localhost:${PORT}`);
});

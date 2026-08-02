"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

type ExamTerminalProps = {
  onReady?: (sandboxId: string, pid: number) => void;
  onGrade?: () => void;
  connectTo?: { sandboxId: string; pid: number };
  disabled?: boolean;
};

const WS_URL = typeof window !== "undefined"
  ? `ws://${window.location.hostname}:3001`
  : "";

export default function ExamTerminal({
  onReady,
  onGrade,
  connectTo,
  disabled,
}: ExamTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sandboxRef = useRef<{ sandboxId?: string; pid?: number }>({});

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connectWs = useCallback(
    (onOpen?: () => void) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (connectTo?.sandboxId && connectTo?.pid) {
          send({ type: "connect", sandboxId: connectTo.sandboxId, pid: connectTo.pid });
        } else if (!disabled) {
          const cols = xtermRef.current?.cols || 80;
          const rows = xtermRef.current?.rows || 24;
          send({ type: "create", cols, rows });
        }
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "data" && xtermRef.current) {
            xtermRef.current.write(new Uint8Array(msg.data));
          } else if (msg.type === "ready") {
            sandboxRef.current = { sandboxId: msg.sandboxId, pid: msg.pid };
            onReady?.(msg.sandboxId, msg.pid);
          } else if (msg.type === "grade_result" && onGrade) {
            // handled by parent via callback
          } else if (msg.type === "error") {
            xtermRef.current?.writeln(`\r\n\x1b[31mError: ${msg.error}\x1b[0m`);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!disabled) {
          setTimeout(() => {
            xtermRef.current?.writeln("\r\n\x1b[33mReconnecting...\x1b[0m");
            connectWs();
          }, 2000);
        }
      };

      ws.onerror = () => {
        xtermRef.current?.writeln(
          "\r\n\x1b[31mTerminal server not running. Start it with: node scripts/exam-terminal-server.mjs\x1b[0m",
        );
      };
    },
    [connectTo, disabled, onReady, send],
  );

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    try { fitAddon.fit(); } catch {}

    term.onData((data) => {
      send({ type: "input", data: Array.from(new TextEncoder().encode(data)) });
    });

    term.onResize(({ cols, rows }) => {
      send({ type: "resize", cols, rows });
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      try { fitAddon.fit(); } catch {}
    };
    window.addEventListener("resize", handleResize);

    connectWs(() => {
      setTimeout(() => {
        try { fitAddon.fit(); } catch {}
        const cols = term.cols;
        const rows = term.rows;
        send({ type: "resize", cols, rows });
      }, 200);
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      send({ type: "kill" });
      term.dispose();
      wsRef.current?.close();
    };
  }, [connectWs, send]);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full"
      style={{ backgroundColor: "#1e1e1e" }}
    />
  );
}

export { WS_URL };

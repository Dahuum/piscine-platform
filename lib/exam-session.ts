import { kv } from "@vercel/kv";

export type ExamSessionStatus =
  | "active"
  | "completed"
  | "timeout"
  | "abandoned";

export type LevelHistoryEntry = {
  level: number;
  exercise: string;
  passed: boolean;
  attempts: number;
  timeSpentSeconds: number;
};

export type ExamSession = {
  weekId: string;
  mode: "editor" | "terminal";
  visitorId: string;
  startTime: number;
  currentLevel: number;
  assignmentCount: number;
  gradePerLevel: number;
  accumulatedPoints: number;
  currentExercise: string;
  cooldownUntil: number;
  successEx: string[];
  levelHistory: LevelHistoryEntry[];
  status: ExamSessionStatus;
  sandboxId?: string;
  levelStartedAt: number;
};

const SESSION_TTL = 5 * 60 * 60; // 5 hours
const TIME_LIMIT_MINUTES = 240;

export function generateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sessionKey(token: string): string {
  return `exam:session:${token}`;
}

function historyKey(visitorId: string): string {
  return `exam:history:${visitorId}`;
}

export async function createSession(
  weekId: string,
  mode: "editor" | "terminal",
  visitorId: string,
  gradePerLevel: number,
  currentExercise: string,
): Promise<{ token: string; session: ExamSession }> {
  const token = generateToken();
  const now = Date.now();
  const session: ExamSession = {
    weekId,
    mode,
    visitorId,
    startTime: now,
    currentLevel: 0,
    assignmentCount: 0,
    gradePerLevel,
    accumulatedPoints: 0,
    currentExercise,
    cooldownUntil: 0,
    successEx: [],
    levelHistory: [],
    status: "active",
    levelStartedAt: now,
  };

  await kv.set(sessionKey(token), JSON.stringify(session), {
    ex: SESSION_TTL,
  });

  return { token, session };
}

export async function getSession(
  token: string,
): Promise<ExamSession | null> {
  const raw = await kv.get<string>(sessionKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExamSession;
  } catch {
    return null;
  }
}

export async function updateSession(
  token: string,
  session: ExamSession,
): Promise<void> {
  await kv.set(sessionKey(token), JSON.stringify(session), {
    ex: SESSION_TTL,
  });
}

export async function deleteSession(token: string): Promise<void> {
  await kv.del(sessionKey(token));
}

export function getTimeRemaining(session: ExamSession): number {
  const elapsed = (Date.now() - session.startTime) / 1000;
  const total = TIME_LIMIT_MINUTES * 60;
  return Math.max(0, total - elapsed);
}

export function isTimeExpired(session: ExamSession): boolean {
  return getTimeRemaining(session) <= 0;
}

export function isCooldownActive(session: ExamSession): boolean {
  return Date.now() < session.cooldownUntil;
}

export function getCooldownRemaining(session: ExamSession): number {
  return Math.max(0, session.cooldownUntil - Date.now());
}

export type ExamAttempt = {
  id: string;
  weekId: string;
  mode: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  result: ExamSessionStatus;
  finalGrade: number;
  levels: LevelHistoryEntry[];
};

export async function saveAttempt(
  visitorId: string,
  session: ExamSession,
): Promise<void> {
  const attempts = await getAttempts(visitorId);
  const attempt: ExamAttempt = {
    id: generateToken().slice(0, 12),
    weekId: session.weekId,
    mode: session.mode,
    startedAt: session.startTime,
    endedAt: Date.now(),
    duration: Math.round((Date.now() - session.startTime) / 1000),
    result: session.status,
    finalGrade: Math.min(
      100,
      session.gradePerLevel * session.currentLevel,
    ),
    levels: session.levelHistory,
  };
  attempts.unshift(attempt);
  await kv.set(historyKey(visitorId), JSON.stringify(attempts));
}

export async function getAttempts(
  visitorId: string,
): Promise<ExamAttempt[]> {
  const raw = await kv.get<string>(historyKey(visitorId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ExamAttempt[];
  } catch {
    return [];
  }
}

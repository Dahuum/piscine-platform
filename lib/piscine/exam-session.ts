import { getPool } from './pg-pool'

export type ExamSessionStatus = 'active' | 'completed' | 'timeout' | 'abandoned'

export type LevelHistoryEntry = {
  level: number
  exercise: string
  passed: boolean
  attempts: number
  timeSpentSeconds: number
}

export type ExamSession = {
  weekId: string
  mode: 'editor' | 'terminal'
  visitorId: string
  startTime: number
  currentLevel: number
  assignmentCount: number
  gradePerLevel: number
  accumulatedPoints: number
  currentExercise: string
  cooldownUntil: number
  successEx: string[]
  levelHistory: LevelHistoryEntry[]
  status: ExamSessionStatus
  sandboxId?: string
  levelStartedAt: number
}

const SESSION_TTL = 5 * 60 * 60 // 5 hours
const TIME_LIMIT_MINUTES = 240

export function generateToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createSession(
  weekId: string,
  mode: 'editor' | 'terminal',
  visitorId: string,
  gradePerLevel: number,
  currentExercise: string,
): Promise<{ token: string; session: ExamSession }> {
  const token = generateToken()
  const now = Date.now()
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
    status: 'active',
    levelStartedAt: now,
  }

  await getPool().query(
    `INSERT INTO exam_sessions (token, data, expires_at) VALUES ($1, $2, now() + $3 * interval '1 second')`,
    [token, JSON.stringify(session), SESSION_TTL],
  )

  return { token, session }
}

export async function getSession(token: string): Promise<ExamSession | null> {
  const { rows } = await getPool().query(`SELECT data FROM exam_sessions WHERE token = $1 AND expires_at > now()`, [token])
  if (rows.length === 0) return null
  return rows[0].data as ExamSession
}

// Used by /api/exam/start to avoid creating a second "active" row for a
// visitor who already has one running for this week — a double-click on
// "Begin Exam", or a client that lost its saved token and re-starts,
// would otherwise leave the earlier session orphaned until its 5h TTL.
export async function getActiveSessionForVisitor(weekId: string, visitorId: string): Promise<{ token: string; session: ExamSession } | null> {
  const { rows } = await getPool().query(
    `SELECT token, data FROM exam_sessions
     WHERE data->>'weekId' = $1 AND data->>'visitorId' = $2
       AND data->>'status' = 'active' AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [weekId, visitorId],
  )
  if (rows.length === 0) return null
  return { token: rows[0].token as string, session: rows[0].data as ExamSession }
}

export async function updateSession(token: string, session: ExamSession): Promise<void> {
  await getPool().query(`UPDATE exam_sessions SET data = $2, expires_at = now() + $3 * interval '1 second' WHERE token = $1`, [
    token,
    JSON.stringify(session),
    SESSION_TTL,
  ])
}

export async function deleteSession(token: string): Promise<void> {
  await getPool().query(`DELETE FROM exam_sessions WHERE token = $1`, [token])
}

export function getTimeRemaining(session: ExamSession): number {
  const elapsed = (Date.now() - session.startTime) / 1000
  const total = TIME_LIMIT_MINUTES * 60
  return Math.max(0, total - elapsed)
}

export function isTimeExpired(session: ExamSession): boolean {
  return getTimeRemaining(session) <= 0
}

export function isCooldownActive(session: ExamSession): boolean {
  return Date.now() < session.cooldownUntil
}

export function getCooldownRemaining(session: ExamSession): number {
  return Math.max(0, session.cooldownUntil - Date.now())
}

export type ExamAttempt = {
  id: string
  weekId: string
  mode: string
  startedAt: number
  endedAt: number
  duration: number
  result: ExamSessionStatus
  finalGrade: number
  levels: LevelHistoryEntry[]
}

export async function saveAttempt(visitorId: string, session: ExamSession): Promise<void> {
  const attempt: ExamAttempt = {
    id: generateToken().slice(0, 12),
    weekId: session.weekId,
    mode: session.mode,
    startedAt: session.startTime,
    endedAt: Date.now(),
    duration: Math.round((Date.now() - session.startTime) / 1000),
    result: session.status,
    finalGrade: Math.min(100, session.gradePerLevel * session.currentLevel),
    levels: session.levelHistory,
  }
  await getPool().query(`INSERT INTO exam_visitor_attempts (visitor_id, data) VALUES ($1, $2)`, [visitorId, JSON.stringify(attempt)])
}

export async function getAttempts(visitorId: string): Promise<ExamAttempt[]> {
  const { rows } = await getPool().query(`SELECT data FROM exam_visitor_attempts WHERE visitor_id = $1 ORDER BY created_at DESC`, [visitorId])
  return rows.map((r) => r.data as ExamAttempt)
}

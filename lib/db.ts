import { createClient } from "./supabase/client";
import type { ExamAttempt } from "./exam-session";
import type { ExamSessionStatus } from "./exam-session";

const supabase = () => createClient();

// `cachedUserId` is kept in sync by the onAuthStateChange subscription below,
// so it never goes stale after a login/logout — unlike a memoized promise,
// which would freeze at whatever the very first call resolved to (often `null`,
// if it ran before the session was hydrated) and never update again.
let cachedUserId: string | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = supabase()
      .auth.getUser()
      .then(({ data }) => {
        cachedUserId = data?.user?.id || null;
        initialized = true;
      })
      .catch(() => {
        initialized = true;
      });

    supabase().auth.onAuthStateChange((_event, session) => {
      cachedUserId = session?.user?.id || null;
      initialized = true;
    });
  }
  return initPromise;
}

async function getUserId(): Promise<string | null> {
  if (!initialized) await ensureInitialized();
  return cachedUserId;
}

export function clearUserIdCache() {
  cachedUserId = null;
  initialized = false;
  initPromise = null;
}

// Lets a caller that already knows the authoritative user id (e.g.
// AuthDialog's own onAuthStateChange handler, which receives the session
// directly) seed the cache immediately instead of waiting on this module's
// own onAuthStateChange subscription above to get around to it. Those are
// two independent subscriptions with no ordering guarantee between them —
// if AuthDialog's hydration logic runs before this module's listener has
// updated cachedUserId, getUserId() returns a stale null (since `initialized`
// is already true from an earlier logged-out call) and every DB read
// silently comes back empty, even though the user really is logged in. This
// closes that race by making the caller who already has the answer just say
// so, rather than relying on both sides to agree on timing.
export function setCachedUserId(id: string | null) {
  cachedUserId = id;
  initialized = true;
}

// ─── Auth ───────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  cachedUserId = data.user?.id || null;
  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase().auth.signUp({ email, password });
  if (error) throw error;
  cachedUserId = data.user?.id || null;
  return data;
}

export async function signOut() {
  await supabase().auth.signOut();
  cachedUserId = null;
}

export function onAuthChange(cb: (userId: string | null) => void) {
  const { data } = supabase().auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user?.id || null;
    cb(cachedUserId);
  });
  return data.subscription.unsubscribe;
}

// ─── Normal Days Progress ───────────────────────────

export async function saveModuleProgress(
  moduleId: string,
  exerciseId: string,
  status: string,
  code?: string,
) {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase()
    .from("normal_days_progress")
    .upsert(
      { user_id: userId, module_id: moduleId, exercise_id: exerciseId, status, code: code || "" },
      { onConflict: "user_id,module_id,exercise_id" },
    );
  if (error) console.error("saveModuleProgress:", error);
}

export async function getModuleProgress(
  moduleId: string,
): Promise<Record<string, { status: string; code: string }>> {
  const userId = await getUserId();
  if (!userId) return {};
  const { data } = await supabase()
    .from("normal_days_progress")
    .select("exercise_id, status, code")
    .eq("user_id", userId)
    .eq("module_id", moduleId);
  const map: Record<string, { status: string; code: string }> = {};
  for (const row of data || []) {
    map[row.exercise_id] = { status: row.status, code: row.code || "" };
  }
  return map;
}

export async function getAllModuleProgress(): Promise<
  Record<string, Record<string, string>>
> {
  const userId = await getUserId();
  if (!userId) return {};
  const { data } = await supabase()
    .from("normal_days_progress")
    .select("module_id, exercise_id, status")
    .eq("user_id", userId);
  const map: Record<string, Record<string, string>> = {};
  for (const row of data || []) {
    if (!map[row.module_id]) map[row.module_id] = {};
    map[row.module_id][row.exercise_id] = row.status;
  }
  return map;
}

// Single round-trip fetch of every exercise's status + code, for hydrating
// localStorage on login (see lib/hydrate-data.ts). getModuleProgress() above
// is per-module and would need one query per module to cover everything.
export async function getAllModuleProgressWithCode(): Promise<
  { moduleId: string; exerciseId: string; status: string; code: string }[]
> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase()
    .from("normal_days_progress")
    .select("module_id, exercise_id, status, code")
    .eq("user_id", userId);
  return (data || []).map((row) => ({
    moduleId: row.module_id,
    exerciseId: row.exercise_id,
    status: row.status,
    code: row.code || "",
  }));
}

// ─── Exam History ────────────────────────────────────

export async function saveExamAttempt(attempt: ExamAttempt) {
  const userId = await getUserId();
  const { error } = await supabase().from("exam_history").insert({
    user_id: userId || null,
    week_id: attempt.weekId,
    mode: attempt.mode,
    started_at: new Date(attempt.startedAt).toISOString(),
    ended_at: new Date(attempt.endedAt).toISOString(),
    duration_seconds: attempt.duration,
    result: attempt.result,
    final_grade: attempt.finalGrade,
    levels: attempt.levels,
  });
  if (error) console.error("saveExamAttempt:", error);
}

export async function getExamHistory(): Promise<ExamAttempt[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase()
    .from("exam_history")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);
  if (!data) return [];
  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id || ""),
    weekId: row.week_id as string,
    mode: row.mode as string,
    startedAt: new Date(row.started_at as string).getTime(),
    endedAt: new Date(row.ended_at as string).getTime(),
    duration: row.duration_seconds as number,
    result: row.result as ExamSessionStatus,
    finalGrade: row.final_grade as number,
    levels: (row.levels as ExamAttempt["levels"]) || [],
  }));
}

// ─── Exam Preparation ────────────────────────────────

export async function savePrepReview(weekId: string) {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase().from("exam_prep").upsert(
    { user_id: userId, week_id: weekId, reviewed: true },
    { onConflict: "user_id,week_id" },
  );
  if (error) console.error("savePrepReview:", error);
}

export async function getPrepReview(weekId: string): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  const { data } = await supabase()
    .from("exam_prep")
    .select("reviewed")
    .eq("user_id", userId)
    .eq("week_id", weekId)
    .single();
  return data?.reviewed || false;
}

export async function getAllPrepReviews(): Promise<Record<string, boolean>> {
  const userId = await getUserId();
  if (!userId) return {};
  const { data } = await supabase()
    .from("exam_prep")
    .select("week_id, reviewed")
    .eq("user_id", userId);
  const map: Record<string, boolean> = {};
  for (const row of data || []) {
    map[row.week_id] = row.reviewed;
  }
  return map;
}

export async function savePrepExercise(
  weekId: string,
  level: number,
  exerciseName: string,
) {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase().from("exam_prep_exercises").upsert(
    { user_id: userId, week_id: weekId, level, exercise_name: exerciseName, done: true },
    { onConflict: "user_id,week_id,level,exercise_name" },
  );
  if (error) console.error("savePrepExercise:", error);
}

export async function getPrepExercises(
  weekId: string,
): Promise<Set<string>> {
  const userId = await getUserId();
  if (!userId) return new Set();
  const { data } = await supabase()
    .from("exam_prep_exercises")
    .select("level, exercise_name")
    .eq("user_id", userId)
    .eq("week_id", weekId);
  const done = new Set<string>();
  for (const row of data || []) {
    done.add(`${row.level}:${row.exercise_name}`);
  }
  return done;
}

export async function getAllPrepExercises(): Promise<
  Record<string, Set<string>>
> {
  const userId = await getUserId();
  if (!userId) return {};
  const { data } = await supabase()
    .from("exam_prep_exercises")
    .select("week_id, level, exercise_name")
    .eq("user_id", userId);
  const map: Record<string, Set<string>> = {};
  for (const row of data || []) {
    if (!map[row.week_id]) map[row.week_id] = new Set();
    map[row.week_id].add(`${row.level}:${row.exercise_name}`);
  }
  return map;
}

// ─── User Settings ────────────────────────────────────

export async function saveTheme(theme: string) {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase().from("user_settings").upsert(
    { user_id: userId, theme },
    { onConflict: "user_id" },
  );
  if (error) console.error("saveTheme:", error);
}

export async function getTheme(): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase()
    .from("user_settings")
    .select("theme")
    .eq("user_id", userId)
    .single();
  return data?.theme || null;
}

// ─── Sync helpers ────────────────────────────────────

export function syncToLocalStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

export function readFromLocalStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

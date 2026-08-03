import { createClient } from "./supabase/client";
import type { ExamAttempt } from "./exam-session";

const supabase = () => createClient();

export type UserProgress = {
  moduleId: string;
  exerciseId: string;
  status: string;
};

export type ExamHistoryEntry = {
  id?: string;
  user_id?: string;
  week_id: string;
  mode: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  result: string;
  final_grade: number;
  levels: unknown;
};

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getUser();
  return data?.user?.id || null;
}

export async function saveProgress(
  moduleId: string,
  exerciseId: string,
  status: string,
) {
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase().from("user_progress").upsert(
    {
      user_id: userId,
      module_id: moduleId,
      exercise_id: exerciseId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,module_id,exercise_id" },
  );

  if (error) console.error("saveProgress error:", error);
}

export async function getProgress(
  moduleId: string,
): Promise<Record<string, string>> {
  const userId = await getUserId();
  if (!userId) return {};

  const { data, error } = await supabase()
    .from("user_progress")
    .select("exercise_id, status")
    .eq("user_id", userId)
    .eq("module_id", moduleId);

  if (error) {
    console.error("getProgress error:", error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.exercise_id] = row.status;
  }
  return map;
}

export async function saveExamAttempt(attempt: ExamAttempt) {
  const userId = await getUserId();
  const entry: ExamHistoryEntry = {
    user_id: userId || undefined,
    week_id: attempt.weekId,
    mode: attempt.mode,
    started_at: new Date(attempt.startedAt).toISOString(),
    ended_at: new Date(attempt.endedAt).toISOString(),
    duration_seconds: attempt.duration,
    result: attempt.result,
    final_grade: attempt.finalGrade,
    levels: attempt.levels,
  };

  const { error } = await supabase().from("exam_history").insert(entry);
  if (error) console.error("saveExamAttempt error:", error);
}

export async function getExamHistory(): Promise<ExamAttempt[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase()
    .from("exam_history")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("getExamHistory error:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: String(row.id || ""),
    weekId: row.week_id,
    mode: row.mode,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: new Date(row.ended_at).getTime(),
    duration: row.duration_seconds,
    result: row.result,
    finalGrade: row.final_grade,
    levels: (row.levels || []) as ExamAttempt["levels"],
  })) as ExamAttempt[];
}

export async function savePrepReview(weekId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase().from("exam_prep").upsert(
    {
      user_id: userId,
      week_id: weekId,
      reviewed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_id" },
  );
  if (error) console.error("savePrepReview error:", error);
}

export async function getPrepReview(
  weekId: string,
): Promise<boolean> {
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

export async function savePrepExercise(
  weekId: string,
  level: number,
  exerciseName: string,
): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase().from("exam_prep_exercises").upsert(
    {
      user_id: userId,
      week_id: weekId,
      level,
      exercise_name: exerciseName,
      done: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_id,level,exercise_name" },
  );
  if (error) console.error("savePrepExercise error:", error);
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

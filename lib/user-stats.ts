import { createClient } from "./supabase/client";

const supabase = () => createClient();

export type UserStats = {
  totalExercises: number;
  modulesCompleted: number;
  totalExams: number;
  bestExamGrade: number;
  passRate: number;
  totalHours: number;
  lastActive: string | null;
  examWeeks: { weekId: string; attempts: number; best: number }[];
  recentExams: { id: string; weekId: string; grade: number; date: string; result: string }[];
};

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getUser();
  return data?.user?.id || null;
}

export async function getUserEmail(): Promise<string | null> {
  const { data } = await supabase().auth.getUser();
  return data?.user?.email || null;
}

export async function getUserStats(): Promise<UserStats | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const [
    progress,
    exams,
    lastActive,
  ] = await Promise.all([
    supabase().from("normal_days_progress").select("module_id, exercise_id, status, updated_at").eq("user_id", userId),
    supabase().from("exam_history").select("*").eq("user_id", userId).order("started_at", { ascending: false }),
    supabase().from("normal_days_progress").select("updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1),
  ]);

  const progressRows = progress.data || [];
  const examRows = exams.data || [];
  const lastActiveRow = lastActive.data?.[0];

  const doneExercises = progressRows.filter((r) => r.status === "done");
  const uniqueModules = new Set(doneExercises.map((r) => r.module_id));

  const totalExams = examRows.length;
  const bestExamGrade = examRows.length
    ? Math.max(...examRows.map((e) => e.final_grade || 0))
    : 0;
  const passedExams = examRows.filter(
    (e) => e.result === "completed",
  ).length;
  const passRate = totalExams
    ? Math.round((passedExams / totalExams) * 100)
    : 0;
  const totalDurationSeconds = examRows.reduce(
    (s, e) => s + (e.duration_seconds || 0),
    0,
  );
  const totalHours = Math.round(totalDurationSeconds / 3600 * 10) / 10;

  const weekMap: Record<string, { attempts: number; best: number }> = {};
  for (const e of examRows) {
    if (!weekMap[e.week_id]) weekMap[e.week_id] = { attempts: 0, best: 0 };
    weekMap[e.week_id].attempts++;
    weekMap[e.week_id].best = Math.max(
      weekMap[e.week_id].best,
      e.final_grade || 0,
    );
  }

  return {
    totalExercises: doneExercises.length,
    modulesCompleted: uniqueModules.size,
    totalExams,
    bestExamGrade,
    passRate,
    totalHours,
    lastActive: lastActiveRow?.updated_at || null,
    examWeeks: Object.entries(weekMap).map(([weekId, data]) => ({
      weekId,
      ...data,
    })),
    recentExams: examRows.slice(0, 5).map((e) => ({
      id: String(e.id),
      weekId: e.week_id,
      grade: e.final_grade || 0,
      date: new Date(e.started_at).toISOString(),
      result: e.result,
    })),
  };
}

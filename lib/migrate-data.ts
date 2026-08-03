import { createClient } from "./supabase/client";

const supabase = () => createClient();

export function detectExistingData(): {
  hasData: boolean;
  stats: { exercises: number; exams: number; prep: number };
} {
  let exercises = 0;
  let exams = 0;
  let prep = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("progress:") || key.startsWith("code:")) exercises++;
      if (key === "exam:history") exams++;
      if (key.startsWith("exam:prep:")) prep++;
    }
  } catch {}

  return {
    hasData: exercises > 0 || exams > 0 || prep > 0,
    stats: { exercises, exams, prep },
  };
}

async function safeUpsert(table: string, data: Record<string, unknown>, conflict: string) {
  try {
    await supabase().from(table).upsert(data, { onConflict: conflict });
  } catch {}
}

export async function migrateAllData(): Promise<{
  exercises: number;
  exams: number;
  prep: number;
}> {
  const { data } = await supabase().auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return { exercises: 0, exams: 0, prep: 0 };

  let exercisesCount = 0;
  let examsCount = 0;
  let prepCount = 0;

  const keysToRemove: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (!val) continue;

      const progressMatch = key.match(/^progress:(.+):(.+)$/);
      if (progressMatch) {
        const [, moduleId, exerciseId] = progressMatch;
        const codeKey = `code:${moduleId}:${exerciseId}`;
        const code = localStorage.getItem(codeKey) || "";
        await safeUpsert("normal_days_progress", {
          user_id: userId, module_id: moduleId, exercise_id: exerciseId, status: val, code,
        }, "user_id,module_id,exercise_id");
        exercisesCount++;
        keysToRemove.push(key);
        if (code && !keysToRemove.includes(codeKey)) keysToRemove.push(codeKey);
        continue;
      }

      const codeMatch = key.match(/^code:(.+):(.+)$/);
      if (codeMatch && !keysToRemove.includes(key)) {
        const [, moduleId, exerciseId] = codeMatch;
        await safeUpsert("normal_days_progress", {
          user_id: userId, module_id: moduleId, exercise_id: exerciseId, code: val,
        }, "user_id,module_id,exercise_id");
        exercisesCount++;
        keysToRemove.push(key);
        continue;
      }

      if (key === "exam:history") {
        try {
          const attempts = JSON.parse(val) as {
            weekId: string; mode: string; startedAt: number; endedAt: number;
            duration: number; result: string; finalGrade: number; levels: unknown;
          }[];
          for (const a of attempts) {
            try {
              await supabase().from("exam_history").insert({
                user_id: userId,
                week_id: a.weekId, mode: a.mode,
                started_at: new Date(a.startedAt).toISOString(),
                ended_at: new Date(a.endedAt).toISOString(),
                duration_seconds: a.duration, result: a.result,
                final_grade: a.finalGrade, levels: a.levels,
              });
              examsCount++;
            } catch {}
          }
        } catch {}
        keysToRemove.push(key);
        continue;
      }

      const reviewMatch = key.match(/^exam:prep:reviewed:(.+)$/);
      if (reviewMatch) {
        const weekId = reviewMatch[1];
        if (val === "true") {
          await safeUpsert("exam_prep", {
            user_id: userId, week_id: weekId, reviewed: true,
          }, "user_id,week_id");
          prepCount++;
        }
        keysToRemove.push(key);
        continue;
      }

      const prepExMatch = key.match(/^exam:prep:(.+):(\d+):(.+)$/);
      if (prepExMatch) {
        const [, weekId, level, name] = prepExMatch;
        if (val === "done") {
          await safeUpsert("exam_prep_exercises", {
            user_id: userId, week_id: weekId, level: parseInt(level), exercise_name: name, done: true,
          }, "user_id,week_id,level,exercise_name");
          prepCount++;
        }
        keysToRemove.push(key);
        continue;
      }
    }
  } catch {}

  return { exercises: exercisesCount, exams: examsCount, prep: prepCount };
}

export function clearLocalData() {
  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith("progress:") ||
        key.startsWith("code:") ||
        key === "exam:history" ||
        key.startsWith("exam:prep:")
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {}
}

export function getLocalDataSummary(): string[] {
  const items: string[] = [];
  try {
    let moduleExs = 0;
    let hasExams = false;
    let prepExs = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("progress:")) moduleExs++;
      if (key === "exam:history") hasExams = true;
      if (key.startsWith("exam:prep:") && key.includes(":") && key.split(":").length >= 4) prepExs++;
    }
    if (moduleExs > 0) items.push(`${Math.round(moduleExs / 2)} exercises completed`);
    if (hasExams) items.push("Exam attempts saved");
    if (prepExs > 0) items.push(`${prepExs} exercises reviewed`);
  } catch {}
  return items;
}

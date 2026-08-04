// Pulls a logged-in user's cloud-synced progress back into localStorage.
//
// This is the mirror image of migrate-data.ts (which pushes local -> cloud
// once, at signup/login). Every page in this app (ModuleCard, the module
// list, the exercise editor, exam prep) reads its state from localStorage
// only — none of them query Supabase directly. Without this step, a user
// who signs in on a browser/device where localStorage is empty (a new
// device, or one that was cleared) sees an account with stats but no
// visible progress, even though the rows are safely in the database.
import { getAllModuleProgressWithCode, getAllPrepReviews, getAllPrepExercises } from "@/lib/db";

export async function hydrateFromCloud(): Promise<boolean> {
  let wrote = false;

  try {
    const progress = await getAllModuleProgressWithCode();
    for (const row of progress) {
      const progressKey = `progress:${row.moduleId}:${row.exerciseId}`;
      const codeKey = `code:${row.moduleId}:${row.exerciseId}`;
      // Don't clobber anything already sitting in localStorage (e.g. an
      // edit made in this tab moments ago that hasn't synced up yet) -
      // only fill in what's missing.
      if (row.status && localStorage.getItem(progressKey) === null) {
        localStorage.setItem(progressKey, row.status);
        wrote = true;
      }
      if (row.code && localStorage.getItem(codeKey) === null) {
        localStorage.setItem(codeKey, row.code);
        wrote = true;
      }
    }

    const reviews = await getAllPrepReviews();
    for (const [weekId, reviewed] of Object.entries(reviews)) {
      const key = `exam:prep:reviewed:${weekId}`;
      if (reviewed && localStorage.getItem(key) === null) {
        localStorage.setItem(key, "true");
        wrote = true;
      }
    }

    const prepExercises = await getAllPrepExercises();
    for (const [weekId, done] of Object.entries(prepExercises)) {
      for (const entry of done) {
        const sep = entry.indexOf(":");
        const level = sep === -1 ? entry : entry.slice(0, sep);
        const name = sep === -1 ? "" : entry.slice(sep + 1);
        const key = `exam:prep:${weekId}:${level}:${name}`;
        if (localStorage.getItem(key) === null) {
          localStorage.setItem(key, "done");
          wrote = true;
        }
      }
    }
  } catch {
    // Best-effort — leave whatever local state already exists untouched.
  }

  return wrote;
}

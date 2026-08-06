import { NextRequest, NextResponse } from "next/server";
import { getExamWeek, getRandomExercise, getExercise } from "@/lib/exam-data";
import {
  createSession,
  updateSession,
  getActiveSessionForVisitor,
  isTimeExpired,
  getTimeRemaining,
} from "@/lib/exam-session";

export async function POST(req: NextRequest) {
  try {
    const { weekId, mode, visitorId, sandboxId } = await req.json();

    if (!weekId || !mode || !visitorId) {
      return NextResponse.json(
        { error: "Missing weekId, mode, or visitorId" },
        { status: 400 },
      );
    }

    if (mode !== "editor" && mode !== "terminal") {
      return NextResponse.json(
        { error: 'Mode must be "editor" or "terminal"' },
        { status: 400 },
      );
    }

    const week = getExamWeek(weekId);

    // Reuse an already-running session for this visitor+week instead of
    // always creating a new one — covers a double-click on "Begin Exam" and
    // a client that lost its saved token (e.g. cleared sessionStorage) but
    // still has a live session server-side, so it doesn't lose progress or
    // get a free cooldown reset by "restarting".
    const existing = await getActiveSessionForVisitor(weekId, visitorId);
    if (existing && !isTimeExpired(existing.session)) {
      const { token, session } = existing;
      const exercise = getExercise(
        weekId,
        session.currentLevel,
        session.currentExercise,
      );
      if (exercise) {
        return NextResponse.json({
          token,
          resumed: true,
          exercise: {
            name: exercise.name,
            level: exercise.level,
            type: exercise.type,
            subject: exercise.subject,
          },
          startTime: session.startTime,
          timeLimitSeconds: 240 * 60,
          timeRemaining: getTimeRemaining(session),
          gradePerLevel: session.gradePerLevel,
          levelCount: week.levelCount,
          currentLevel: session.currentLevel,
          currentGrade: Math.min(100, session.gradePerLevel * session.currentLevel),
          levelHistory: session.levelHistory,
          cooldownUntil: session.cooldownUntil,
        });
      }
      // Fall through to a fresh session if the stored exercise no longer
      // resolves (content changed) — better than resuming into a dead end.
    }

    const exercise = getRandomExercise(week, 0, []);
    const gradePerLevel = week.gradePerLevel;

    const { token, session } = await createSession(
      weekId,
      mode as "editor" | "terminal",
      visitorId,
      gradePerLevel,
      exercise.name,
    );

    if (sandboxId) {
      session.sandboxId = sandboxId;
      await updateSession(token, session);
    }

    return NextResponse.json({
      token,
      exercise: {
        name: exercise.name,
        level: exercise.level,
        type: exercise.type,
        subject: exercise.subject,
      },
      startTime: session.startTime,
      timeLimitSeconds: 240 * 60,
      gradePerLevel,
      levelCount: week.levelCount,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Exam start error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

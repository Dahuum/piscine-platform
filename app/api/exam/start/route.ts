import { NextRequest, NextResponse } from "next/server";
import { getExamWeek, getRandomExercise } from "@/lib/exam-data";
import { createSession, updateSession } from "@/lib/exam-session";

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

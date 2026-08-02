import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  updateSession,
  isTimeExpired,
  isCooldownActive,
  getCooldownRemaining,
} from "@/lib/exam-session";
import {
  getExamWeek,
  getExercise,
  getRandomExercise,
  isExamComplete,
} from "@/lib/exam-data";
import { gradeSubmission, getCooldownSeconds } from "@/lib/exam-corrector";
import type { LevelHistoryEntry } from "@/lib/exam-session";
import { Sandbox } from "e2b";

export async function POST(req: NextRequest) {
  try {
    const { token, studentCode } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 },
      );
    }

    let code = studentCode || "";

    const session = await getSession(token);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 },
      );
    }

    if (session.status !== "active") {
      return NextResponse.json(
        { error: "Exam is not active", status: session.status },
        { status: 400 },
      );
    }

    if (isTimeExpired(session)) {
      session.status = "timeout";
      await updateSession(token, session);
      return NextResponse.json(
        { error: "Time has expired", status: "timeout" },
        { status: 400 },
      );
    }

    if (isCooldownActive(session)) {
      return NextResponse.json(
        {
          error: "Cooldown active",
          cooldownRemaining: getCooldownRemaining(session),
        },
        { status: 429 },
      );
    }

    const exercise = getExercise(
      session.weekId,
      session.currentLevel,
      session.currentExercise,
    );

    if (session.mode === "terminal" && session.sandboxId && !code) {
      try {
        const sandbox = await Sandbox.connect(session.sandboxId);
        const filePath = `/home/user/rendu/${session.currentExercise}/${session.currentExercise}.c`;
        code = await sandbox.files.read(filePath);
      } catch {
        return NextResponse.json(
          { error: `Could not read your code from the terminal. Save it to rendu/${session.currentExercise}/${session.currentExercise}.c first.` },
          { status: 400 },
        );
      }
    }

    if (!code.trim()) {
      return NextResponse.json(
        { error: "No code to grade" },
        { status: 400 },
      );
    }

    if (!exercise) {
      const week = getExamWeek(session.weekId);
      const newEx = getRandomExercise(
        week,
        session.currentLevel,
        session.successEx,
      );
      session.currentExercise = newEx.name;
      await updateSession(token, session);
      return NextResponse.json({
        error: "Exercise not found, new one assigned",
        exercise: {
          name: newEx.name,
          level: newEx.level,
          type: newEx.type,
          subject: newEx.subject,
        },
      });
    }

    const result = await gradeSubmission(exercise, studentCode);

    const timeOnLevel = Math.round(
      (Date.now() - session.levelStartedAt) / 1000,
    );

    if (result.passed) {
      const historyEntry: LevelHistoryEntry = {
        level: session.currentLevel,
        exercise: session.currentExercise,
        passed: true,
        attempts: session.assignmentCount + 1,
        timeSpentSeconds: timeOnLevel,
      };

      session.levelHistory.push(historyEntry);
      session.successEx.push(session.currentExercise);
      session.currentLevel++;
      session.assignmentCount = 0;
      session.cooldownUntil = 0;
      session.accumulatedPoints += session.gradePerLevel;
      session.levelStartedAt = Date.now();

      if (isExamComplete(session.accumulatedPoints)) {
        session.status = "completed";
        await updateSession(token, session);

        const finalGrade = Math.min(
          100,
          session.gradePerLevel * session.currentLevel,
        );
        return NextResponse.json({
          passed: true,
          examComplete: true,
          finalGrade,
          levelHistory: session.levelHistory,
        });
      }

      let nextExercise;
      try {
        const week = getExamWeek(session.weekId);
        nextExercise = getRandomExercise(
          week,
          session.currentLevel,
          session.successEx,
        );
        session.currentExercise = nextExercise.name;
      } catch {
        session.status = "completed";
        await updateSession(token, session);
        return NextResponse.json({
          passed: true,
          examComplete: true,
          finalGrade: Math.min(
            100,
            session.gradePerLevel * session.currentLevel,
          ),
          levelHistory: session.levelHistory,
        });
      }

      await updateSession(token, session);

      return NextResponse.json({
        passed: true,
        newLevel: session.currentLevel,
        newExercise: {
          name: nextExercise!.name,
          level: nextExercise!.level,
          type: nextExercise!.type,
          subject: nextExercise!.subject,
        },
        grade: session.gradePerLevel * session.currentLevel,
        levelHistory: session.levelHistory,
      });
    } else {
      session.assignmentCount++;
      session.cooldownUntil =
        Date.now() + getCooldownSeconds(session.assignmentCount) * 1000;

      const historyEntry: LevelHistoryEntry = {
        level: session.currentLevel,
        exercise: session.currentExercise,
        passed: false,
        attempts: 1,
        timeSpentSeconds: timeOnLevel,
      };

      const existingFailure = session.levelHistory.find(
        (h) =>
          h.level === session.currentLevel &&
          h.exercise === session.currentExercise,
      );
      if (existingFailure) {
        existingFailure.attempts++;
        existingFailure.timeSpentSeconds += timeOnLevel;
      } else {
        session.levelHistory.push(historyEntry);
      }

      await updateSession(token, session);

      return NextResponse.json({
        passed: false,
        traceback: result.traceback,
        compilationError: result.compilationError,
        cooldownSeconds: getCooldownSeconds(session.assignmentCount),
        cooldownUntil: session.cooldownUntil,
        assignmentCount: session.assignmentCount,
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Exam grade error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

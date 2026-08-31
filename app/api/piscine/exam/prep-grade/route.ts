import { NextRequest, NextResponse } from 'next/server'
import { getExerciseByName } from '@/lib/piscine/exam-data'
import { gradeSubmission } from '@/lib/piscine/exam-corrector'

// Practice-mode grading for the exam prep flow — same real reference-code
// + test-case comparison the live timed exam uses (lib/piscine/exam-corrector.ts),
// just without any of the session/cooldown/scoring machinery in
// /api/piscine/exam/grade, since this isn't a graded attempt. Exists so prep
// can tell a genuinely correct submission from one that merely ran without
// crashing — the prep page marks an exercise "done" only on a real pass from here.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { weekId, exerciseName, code } = await req.json()

    if (!weekId || !exerciseName || !code?.trim()) {
      return NextResponse.json({ error: 'Missing weekId, exerciseName, or code' }, { status: 400 })
    }

    const exercise = getExerciseByName(weekId, exerciseName)
    if (!exercise) {
      return NextResponse.json({ error: 'Unknown exam exercise' }, { status: 400 })
    }

    const result = await gradeSubmission(exercise, code)
    return NextResponse.json(result)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('Prep grade error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { executeCode } from '@/lib/piscine/sandbox'
import { modules } from '@/lib/piscine/modules'
import { getExerciseByName } from '@/lib/piscine/exam-data'
import { runExamExercise } from '@/lib/piscine/exam-corrector'

// Sandbox create + compile + run comfortably fits in this, but the default
// serverless timeout (10s on Hobby) does not.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { code, exerciseId, moduleId } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    if (moduleId && moduleId.startsWith('exam_')) {
      const exercise = exerciseId ? getExerciseByName(moduleId, exerciseId) : null
      if (!exercise) {
        return NextResponse.json({ error: 'Unknown exam exercise' }, { status: 400 })
      }
      // Function-type exercises are a bare function with no main() of their
      // own — they need exercise.mainCode linked in to run at all. And
      // running against the exercise's own test cases (rather than with no
      // arguments) is what makes this useful to a student practicing.
      const output = await runExamExercise(exercise, code)
      return NextResponse.json({ output })
    }

    if (!moduleId) {
      return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
    }

    const mod = modules[moduleId as keyof typeof modules]
    if (!mod) {
      return NextResponse.json({ error: 'Unknown module' }, { status: 400 })
    }

    const output = await executeCode(code, mod.type as 'c' | 'shell')
    return NextResponse.json({ output })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Execute error:', error)
    return NextResponse.json({ output: `Error: ${message}`, error: message }, { status: 200 })
  }
}

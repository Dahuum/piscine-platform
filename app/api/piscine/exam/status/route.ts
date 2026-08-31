import { NextRequest, NextResponse } from 'next/server'
import { getSession, getTimeRemaining, isTimeExpired, updateSession } from '@/lib/piscine/exam-session'
import { getExamWeek } from '@/lib/piscine/exam-data'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 })
  }

  const session = await getSession(token)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.status === 'active' && isTimeExpired(session)) {
    session.status = 'timeout'
    await updateSession(token, session)
  }

  const week = getExamWeek(session.weekId)
  const timeRemaining = getTimeRemaining(session)

  return NextResponse.json({
    status: session.status,
    weekId: session.weekId,
    mode: session.mode,
    currentLevel: session.currentLevel,
    levelCount: week.levelCount,
    grade: Math.min(100, session.gradePerLevel * session.currentLevel),
    currentExercise: session.currentExercise,
    timeRemaining,
    cooldownUntil: session.cooldownUntil,
    assignmentCount: session.assignmentCount,
    levelHistory: session.levelHistory,
    accumulatedPoints: session.accumulatedPoints,
  })
}

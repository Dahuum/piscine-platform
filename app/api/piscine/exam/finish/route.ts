import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, saveAttempt } from '@/lib/piscine/exam-session'

export async function POST(req: NextRequest) {
  try {
    const { token, reason } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const session = await getSession(token)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'active') {
      await saveAttempt(session.visitorId, session)
      return NextResponse.json({
        saved: true,
        status: session.status,
        grade: Math.min(100, session.gradePerLevel * session.currentLevel),
        levelHistory: session.levelHistory,
      })
    }

    if (reason === 'timeout') {
      session.status = 'timeout'
    } else if (reason === 'completed') {
      // status already set by grade route, just save
    } else {
      session.status = 'abandoned'
    }

    await updateSession(token, session)
    await saveAttempt(session.visitorId, session)

    return NextResponse.json({
      saved: true,
      status: session.status,
      grade: Math.min(100, session.gradePerLevel * session.currentLevel),
      levelHistory: session.levelHistory,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('Exam finish error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

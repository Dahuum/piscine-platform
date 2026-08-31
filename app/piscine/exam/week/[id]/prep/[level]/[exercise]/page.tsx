'use client'

import { BookOpen, Check, ChevronLeft, Lightbulb, PanelLeftClose, PanelLeftOpen, Play, RotateCw } from 'lucide-react'
import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import CodeEditor from '@/components/piscine/code-editor'
import { ExplanationPanel } from '@/components/piscine/explanation-panel'
import ThemeToggle from '@/components/theme-toggle'
import { savePrepExercise } from '@/lib/piscine/db'
import { buildExplanationPrompt } from '@/lib/piscine/explanation'
import { getExamWeekOrNull, type ExamExercise } from '@/lib/piscine/exam-data'

export default function ExamPrepExercisePage() {
  const params = useParams<{ id: string; level: string; exercise: string }>()
  const weekId = params.id
  const week = getExamWeekOrNull(weekId)
  if (!week) notFound()
  const lvl = parseInt(params.level, 10)
  const ex = week.exercises.find((e) => e.level === lvl && e.name === params.exercise)
  if (!ex) notFound()
  return <PrepPracticeInner key={`${weekId}:${lvl}:${ex.name}`} weekId={weekId} exercise={ex} />
}

function PrepPracticeInner({ weekId, exercise }: { weekId: string; exercise: ExamExercise }) {
  const week = getExamWeekOrNull(weekId)!
  const codeKey = `exam:code:${weekId}:${exercise.level}:${exercise.name}`
  const prepKey = `exam:prep:${weekId}:${exercise.level}:${exercise.name}`
  const explanationCacheKey = `explanation:exam:v1:${weekId}:${exercise.level}:${exercise.name}`
  const explanationPrompt = buildExplanationPrompt({
    context: `Exam: ${week.title}, Level ${exercise.level}`,
    title: exercise.name,
    description: exercise.subject.description,
    allowed: exercise.subject.allowed,
  })

  // `code` feeds Monaco (loaded with ssr:false) so its initial value never
  // reaches server-rendered HTML — safe to read localStorage directly.
  // `isDone` renders straight into a visible "Done" pill, so it starts false
  // on both server and client and gets corrected by the mount effect below.
  const [code, setCode] = useState(() => (typeof window !== 'undefined' && localStorage.getItem(codeKey)) || '')
  const [output, setOutput] = useState('')
  const [passed, setPassed] = useState<boolean | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [running, setRunning] = useState(false)
  const [leftTab, setLeftTab] = useState<'exercise' | 'explanation'>('exercise')
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    setIsDone(localStorage.getItem(prepKey) === 'done')
  }, [prepKey])

  useEffect(() => {
    if (output && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  const markDone = () => {
    localStorage.setItem(prepKey, 'done')
    setIsDone(true)
    savePrepExercise(weekId, exercise.level, exercise.name).catch(() => {})
  }

  const handleRun = async () => {
    if (!code.trim()) return
    setRunning(true)
    setOutput('')
    setPassed(null)
    try {
      const res = await fetch('/api/piscine/exam/prep-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, exerciseName: exercise.name, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setOutput(data.error || 'Grading failed')
        setPassed(false)
      } else if (data.passed) {
        setOutput('All test cases passed.')
        setPassed(true)
        markDone()
      } else if (data.systemError) {
        setOutput(data.error || 'System error while grading — please try again.')
      } else {
        setOutput(data.traceback || data.compilationError || 'Some test cases failed.')
        setPassed(false)
      }
    } catch {
      setOutput('Execution failed')
      setPassed(false)
    }
    setRunning(false)
  }

  const verdictClass = passed === true ? 'pass' : passed === false ? 'fail' : ''

  return (
    <div className="ide-page">
      <div className="ide-topbar">
        <Link href={`/piscine/exam/week/${weekId}/prep`} className="back-link" style={{ marginTop: 0 }}>
          <ChevronLeft size={13} /> {week.title} prep
        </Link>
        <span className="sep">/</span>
        <span className="ex-title">{exercise.name}</span>
        <span className="ex-num">Level {exercise.level}</span>
        {isDone && <span className="pill st-done">Done</span>}
        <span className="spacer" />
        <ThemeToggle />
      </div>

      <div className="ide-body">
        {leftPanelOpen ? (
          <div className="ide-side" style={{ '--w': '340px' } as React.CSSProperties}>
            <div className="ide-side-tabs">
              <button className={`ide-tab ${leftTab === 'exercise' ? 'on' : ''}`} onClick={() => setLeftTab('exercise')}>
                <BookOpen size={13} /> Exercise
              </button>
              <button className={`ide-tab ${leftTab === 'explanation' ? 'on' : ''}`} onClick={() => setLeftTab('explanation')}>
                <Lightbulb size={13} /> Explanation
              </button>
              <button className="ide-tab-close" onClick={() => setLeftPanelOpen(false)} aria-label="Hide panel">
                <PanelLeftClose size={13} />
              </button>
            </div>
            <div className="ide-side-body">
              {leftTab === 'exercise' ? (
                <>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{exercise.subject.description}</p>
                  {exercise.subject.files.length > 0 && (
                    <>
                      <p className="ide-field-label">Turn-in files</p>
                      <div className="ide-fn-chips">
                        {exercise.subject.files.map((f) => (
                          <span key={f} className="ide-fn-chip file">{f}</span>
                        ))}
                      </div>
                    </>
                  )}
                  {exercise.subject.allowed.length > 0 && (
                    <>
                      <p className="ide-field-label">Allowed functions</p>
                      <div className="ide-fn-chips">
                        {exercise.subject.allowed.map((fn) => (
                          <span key={fn} className="ide-fn-chip">{fn}</span>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="ide-compile-note">{exercise.testCases.length} test case{exercise.testCases.length === 1 ? '' : 's'} · {exercise.type} exercise</p>
                </>
              ) : (
                <>
                  <ExplanationPanel cacheKey={explanationCacheKey} prompt={explanationPrompt} />
                  <p className="ide-compile-note">In the real exam, no explanations are available — practice without them when ready.</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="ide-collapsed-rail">
            <button onClick={() => setLeftPanelOpen(true)} aria-label="Show panel">
              <PanelLeftOpen size={13} />
            </button>
          </div>
        )}

        <div className="ide-main">
          <div className="ide-toolbar">
            <button className="ide-run" onClick={handleRun} disabled={running}>
              {running ? <RotateCw size={13} className="spin" /> : <Play size={13} />}
              {running ? 'Grading' : 'Run'}
            </button>
            <span className="ide-hint">Runs against {exercise.testCases.length} test case{exercise.testCases.length === 1 ? '' : 's'}</span>
            <span className="spacer" style={{ flex: 1 }} />
            {isDone && <span className="ide-mark-done done"><Check size={12} /> Done</span>}
          </div>

          <div className="ide-editor">
            <CodeEditor
              value={code}
              onChange={(v) => {
                const val = v || ''
                setCode(val)
                localStorage.setItem(codeKey, val)
              }}
              language="c"
            />
          </div>

          <div className="ide-console" style={{ height: 'min(220px, 40vh)' }}>
            <div className="ide-console-head">
              <span className="label">Output</span>
              {running && <span className="running">grading…</span>}
              <span className="spacer" style={{ flex: 1 }} />
              {passed !== null && <span className={`ide-verdict ${verdictClass}`}>{passed ? '✅ Passed' : '❌ Failed'}</span>}
            </div>
            <pre ref={outputRef} className="ide-console-body">
              {output || <span className="ide-console-empty">// Write your code and press Run</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

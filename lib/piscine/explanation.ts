// The chat API streams NDJSON-ish lines prefixed "0:<json-encoded-chunk>"
// (see app/api/piscine/chat/route.ts) — this collapses a full response body
// back into plain text.
export function parseChatStream(text: string): string {
  const parts = text.split('\n').filter((l) => l.startsWith('0:'))
  return parts
    .map((l) => {
      try {
        return JSON.parse(l.slice(2))
      } catch {
        return ''
      }
    })
    .join('')
}

// Builds the prompt for the "Explanation" tab. `context` is a caller-chosen
// first line (e.g. "Module: C 07" or "Exam: Exam Week 04, Level 2") so the
// same prompt shape works for both regular modules and exam-prep exercises.
export function buildExplanationPrompt({
  context,
  title,
  description,
  prototype,
  allowed,
}: {
  context: string
  title: string
  description: string
  prototype?: string
  allowed?: string[]
}): string {
  const proto = prototype ? `Prototype: ${prototype}` : ''
  const allowedLine = allowed && allowed.length > 0 ? `Allowed: ${allowed.join(', ')}` : ''
  return `You are teaching beginners at the 42 School C Piscine. Be simple and direct. NEVER give the complete solution — students must figure it out themselves. Show SIMILAR examples instead, never the exact answer.

${context}
Exercise: ${title}
Description: ${description}
${proto}
${allowedLine}

Reply in this exact format:

WHAT YOU'RE LEARNING:
1 short sentence about the concept.

HOW TO APPROACH:
- Think about what the function receives as input
- What should it do with that input
- What should it output (if anything)

SIMILAR EXAMPLE:
\`\`\`c
// Show a DIFFERENT but similar function — NOT the solution to this exercise.
// For example: if the exercise asks to print a char, show how to print a number instead.
// This helps them understand the pattern without giving away the answer.
\`\`\`

HOW IT BEHAVES:
\`\`\`
// Show what the SIMILAR example does with real input/output
\`\`\`

WATCH OUT FOR:
- Common mistake beginners make
- Another mistake`
}

export function verdictPrompt(moduleTitle: string, exerciseTitle: string, description: string, type: string, code: string, prototype?: string) {
  return `Exercise: ${moduleTitle} - ${exerciseTitle}
Description: ${description}
${prototype ? `Prototype: ${prototype}` : ''}
Student code:
\`\`\`${type === 'shell' ? 'sh' : 'c'}
${code}
\`\`\`

Evaluate if this code correctly implements the exercise. There is no compiler or test runner grounding this check — you are the only judge, so think it through carefully before deciding rather than pattern-matching on how the code looks. Reply in EXACTLY this format:

REASONING:
Mentally trace what this code actually does for a couple of concrete inputs implied by the description/prototype. Check: does the logic match the required behavior for those inputs? Does it only use allowed functions? Any edge case (empty input, boundary value, sign, off-by-one) it would get wrong? 2-4 sentences, then decide.

VERDICT: <✅ or ❌, followed by a short reason, max 15 words>

Only if the verdict is ❌, follow with a blank line then:
DETAILS:
- Test: <a concrete input/scenario that breaks this code>
  Expected: <what correct output/behavior should be>
  Got: <what this code actually does instead, and why>
(add a second "- Test:" bullet only if there's a second, distinct failure worth flagging)

If the verdict is ✅, output nothing after the VERDICT line — no DETAILS section at all. Do not let the REASONING section change the required format of what follows it.`
}

// Splits the AI's "REASONING: ...\n\nVERDICT: ...\n\nDETAILS:\n..." reply
// into the short status line and the longer failure breakdown, shown only
// when the verdict is ❌.
export function parseVerdict(raw: string): { verdict: string; details: string } {
  const vIdx = raw.indexOf('VERDICT:')
  const afterVerdict = vIdx === -1 ? raw : raw.slice(vIdx)
  const dIdx = afterVerdict.indexOf('DETAILS:')
  const verdictPart = (dIdx === -1 ? afterVerdict : afterVerdict.slice(0, dIdx)).replace(/^VERDICT:\s*/i, '').trim()
  const detailsPart = dIdx === -1 ? '' : afterVerdict.slice(dIdx + 'DETAILS:'.length).trim()
  return { verdict: verdictPart, details: detailsPart }
}

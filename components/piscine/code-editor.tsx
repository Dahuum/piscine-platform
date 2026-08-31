'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { BeforeMount } from '@monaco-editor/react'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="ide-editor-loading" />,
})

// Monaco can't read CSS custom properties, so its theme is defined with the
// same literal hex values as the site's light/dark palettes in globals.css —
// keep these two in sync if the palette ever changes.
const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('outercore-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6f706b', fontStyle: 'italic' },
      { token: 'keyword', foreground: '6252d9', fontStyle: 'bold' },
      { token: 'string', foreground: '0f8f6f' },
      { token: 'number', foreground: 'ff785d' },
    ],
    colors: {
      'editor.background': '#f5f2ec',
      'editor.foreground': '#171918',
      'editorLineNumber.foreground': '#c9c6bd',
      'editorLineNumber.activeForeground': '#6f706b',
      'editor.selectionBackground': '#d7ff4560',
      'editor.inactiveSelectionBackground': '#d7ff4530',
      'editorCursor.foreground': '#6252d9',
      'editor.lineHighlightBackground': '#e7e3dc80',
      'editorIndentGuide.background': '#c9c6bd50',
      'editorIndentGuide.activeBackground': '#c9c6bd',
    },
  })
  monaco.editor.defineTheme('outercore-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '96988f', fontStyle: 'italic' },
      { token: 'keyword', foreground: '9d8cff', fontStyle: 'bold' },
      { token: 'string', foreground: '49e0b6' },
      { token: 'number', foreground: 'ff9d7a' },
    ],
    colors: {
      'editor.background': '#181b19',
      'editor.foreground': '#ecebe4',
      'editorLineNumber.foreground': '#2e322c',
      'editorLineNumber.activeForeground': '#96988f',
      'editor.selectionBackground': '#d7ff4530',
      'editor.inactiveSelectionBackground': '#d7ff4518',
      'editorCursor.foreground': '#9d8cff',
      'editor.lineHighlightBackground': '#20241f',
      'editorIndentGuide.background': '#2e322c80',
      'editorIndentGuide.activeBackground': '#2e322c',
    },
  })
}

export default function CodeEditor({
  value,
  onChange,
  language,
}: {
  value: string
  onChange: (value: string | undefined) => void
  language: 'c' | 'shell'
}) {
  const [theme, setTheme] = useState<'outercore-dark' | 'outercore-light'>('outercore-light')

  useEffect(() => {
    const update = () => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'outercore-dark' : 'outercore-light')
    }
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return (
    <MonacoEditor
      height="100%"
      language={language === 'shell' ? 'shell' : 'c'}
      value={value}
      onChange={onChange}
      theme={theme}
      beforeMount={beforeMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13.5,
        fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: false,
        wordWrap: 'on',
        padding: { top: 16, bottom: 16 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: true },
      }}
    />
  )
}

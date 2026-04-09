import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import styles from './Markdown.module.css'

interface CodeBlockProps {
  language: string
  children: string
}

// Map common language identifiers
const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', rs: 'rust', sh: 'bash', zsh: 'bash',
  yml: 'yaml', dockerfile: 'docker', tf: 'hcl',
  cs: 'csharp', cpp: 'cpp', cc: 'cpp',
}

// Custom theme based on Catppuccin Mocha
const catppuccinTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#11111b',
    margin: 0,
    padding: '12px 14px',
    fontSize: '12.5px',
    lineHeight: '1.6',
    borderRadius: 0,
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontSize: '12.5px',
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
  },
}

export default function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const lang = LANG_MAP[language] || language || 'text'
  const code = children.replace(/\n$/, '')

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{lang}</span>
        <button className={styles.copyBtn} onClick={handleCopy} title="Copy code">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        style={catppuccinTheme}
        language={lang}
        PreTag="div"
        showLineNumbers={code.split('\n').length > 3}
        lineNumberStyle={{
          color: '#45475a',
          fontSize: '11px',
          minWidth: '2.5em',
          paddingRight: '12px',
          userSelect: 'none',
        }}
        wrapLines
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

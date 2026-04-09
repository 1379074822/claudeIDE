import { memo, useCallback } from 'react'
import { User, FileCode } from 'lucide-react'
import type { ChatMessage } from '../../store'
import { useFileStore } from '../../store'
import { getLanguageFromPath } from '../../utils/fileUtils'
import { parseFileRefs } from '../../utils/parseFileRefs'
import styles from './Message.module.css'

function FileRef({ path, lines, onClick }: { path: string; lines?: string; onClick: () => void }) {
  const name = path.replace(/\\/g, '/').split('/').pop() || path
  const label = lines ? `${name}:${lines}` : name

  return (
    <button className={styles.fileRef} onClick={onClick} title={lines ? `${path}:${lines}` : path}>
      <FileCode size={12} />
      <span>{label}</span>
    </button>
  )
}

function UserMessage({ msg }: { msg: ChatMessage }) {
  const { openFile, setActiveFile, openFiles } = useFileStore()

  const handleRefClick = useCallback(async (path: string, lines?: string) => {
    // If already open, just activate it
    const existing = useFileStore.getState().openFiles.find(f => f.path === path)
    if (existing) {
      setActiveFile(path)
    } else {
      // Read and open
      const api = (window as any).electronAPI
      if (!api) return
      const result = await api.fs.readFile(path)
      if (!result?.success) return
      const name = path.replace(/\\/g, '/').split('/').pop() || path
      openFile({
        path,
        name,
        content: result.content,
        language: getLanguageFromPath(name),
        modified: false,
        originalContent: result.content,
      })
    }

    // Jump to line
    if (lines) {
      const startLine = parseInt(lines.split('-')[0], 10)
      if (!isNaN(startLine)) {
        setTimeout(() => {
          import('monaco-editor').then(monaco => {
            const editors = monaco.editor.getEditors()
            if (editors.length === 0) return
            const ed = editors[editors.length - 1]
            ed.revealLineInCenter(startLine)
            ed.setPosition({ lineNumber: startLine, column: 1 })
            ed.focus()
          })
        }, 200)
      }
    }
  }, [openFile, setActiveFile])

  const parts = parseFileRefs(msg.content)
  const hasRefs = parts.some(p => p.type === 'ref')

  return (
    <div className={`${styles.message} ${styles.user}`}>
      <div className={styles.avatarUser}>
        <User size={13} />
      </div>
      <div className={styles.body}>
        {msg.images && msg.images.length > 0 && (
          <div className={styles.images}>
            {msg.images.map((src, i) => (
              <img key={i} src={src} alt="attachment" className={styles.imageThumb} />
            ))}
          </div>
        )}
        <div className={styles.userText}>
          {hasRefs ? parts.map((part, i) => (
            part.type === 'text'
              ? <span key={i}>{part.value}</span>
              : <FileRef key={i} path={part.path} lines={part.lines} onClick={() => handleRefClick(part.path, part.lines)} />
          )) : msg.content}
        </div>
      </div>
    </div>
  )
}

export default memo(UserMessage)

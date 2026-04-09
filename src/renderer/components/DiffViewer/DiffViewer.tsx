import { diffLines } from '../../utils/fileUtils'
import type { FileDiff } from '../../store/chatStore'
import styles from './DiffViewer.module.css'

interface DiffViewerProps {
  diff: FileDiff
}

export default function DiffViewer({ diff }: DiffViewerProps) {
  const lines = diffLines(diff.oldContent, diff.newContent)
  const added = lines.filter(l => l.type === '+').length
  const removed = lines.filter(l => l.type === '-').length

  const fileName = diff.filePath.replace(/\\/g, '/').split('/').pop() || diff.filePath

  return (
    <div className={styles.diff}>
      <div className={styles.header}>
        <span className={styles.fileName}>{fileName}</span>
        <div className={styles.stats}>
          {added > 0 && <span className={styles.added}>+{added}</span>}
          {removed > 0 && <span className={styles.removed}>-{removed}</span>}
        </div>
      </div>
      <div className={styles.body}>
        {lines.slice(0, 100).map((line, i) => (
          <div
            key={i}
            className={`${styles.line} ${
              line.type === '+' ? styles.lineAdded :
              line.type === '-' ? styles.lineRemoved :
              styles.lineContext
            }`}
          >
            <span className={styles.linePrefix}>{line.type}</span>
            <code className={styles.lineText}>{line.text || ' '}</code>
          </div>
        ))}
        {lines.length > 100 && (
          <div className={styles.more}>... {lines.length - 100} more lines</div>
        )}
      </div>
    </div>
  )
}

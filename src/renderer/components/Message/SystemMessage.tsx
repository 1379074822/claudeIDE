import { memo } from 'react'
import { Info } from 'lucide-react'
import type { ChatMessage } from '../../store'
import styles from './Message.module.css'

function SystemMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className={styles.systemMessage}>
      <Info size={12} className={styles.systemIcon} />
      <span className={styles.systemText}>{msg.content}</span>
    </div>
  )
}

export default memo(SystemMessage)

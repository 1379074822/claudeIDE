import { memo } from 'react'
import type { ChatMessage } from '../../store'
import UserMessage from './UserMessage'
import AssistantMessage from './AssistantMessage'
import SystemMessage from './SystemMessage'
import ToolMessage from './ToolMessage'

interface MessageProps {
  msg: ChatMessage
}

function Message({ msg }: MessageProps) {
  switch (msg.role) {
    case 'user':
      return <UserMessage msg={msg} />
    case 'assistant':
      return <AssistantMessage msg={msg} />
    case 'system':
      return <SystemMessage msg={msg} />
    case 'tool':
      return <ToolMessage msg={msg} />
    default:
      return null
  }
}

// Re-render when message content, streaming state, or segments change.
// For streaming messages, always re-render to ensure live updates.
export default memo(Message, (prev, next) => {
  const p = prev.msg
  const n = next.msg
  // Always re-render if currently streaming or was streaming
  if (p.isStreaming || n.isStreaming) return false
  return (
    p.id === n.id &&
    p.content === n.content &&
    p.toolResult === n.toolResult &&
    p.segments === n.segments
  )
})

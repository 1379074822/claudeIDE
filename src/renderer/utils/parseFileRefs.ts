export type RefPart = { type: 'text'; value: string } | { type: 'ref'; path: string; lines?: string }

/**
 * Parse text into segments of plain text and @file references.
 * Matches: @D:\path\file.ts  @D:\path\file.ts:10-25  @/unix/file.py:3-8
 */
export function parseFileRefs(text: string): RefPart[] {
  const regex = /@((?:[A-Za-z]:[\\/]|\/|\.\/)[^\s]+?)(?::(\d+-\d+))?(?=\s|$)/g
  const parts: RefPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'ref', path: match[1], lines: match[2] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}

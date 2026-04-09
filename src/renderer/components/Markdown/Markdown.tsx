import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'
import styles from './Markdown.module.css'

interface MarkdownProps {
  content: string
}

export default function Markdown({ content }: MarkdownProps) {
  if (!content) return null

  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks with syntax highlighting
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !className

            if (isInline) {
              return (
                <code className={styles.inlineCode} {...props}>
                  {children}
                </code>
              )
            }

            return (
              <CodeBlock language={match?.[1] || ''}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            )
          },

          // Styled pre (wrapper for code blocks)
          pre({ children }) {
            return <>{children}</>
          },

          // Links
          a({ href, children }) {
            return (
              <a
                href={href}
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault()
                  if (href) {
                    const api = (window as any).electronAPI
                    if (api) {
                      // Could open in system browser
                    }
                  }
                }}
              >
                {children}
              </a>
            )
          },

          // Tables
          table({ children }) {
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>{children}</table>
              </div>
            )
          },

          // Blockquote
          blockquote({ children }) {
            return <blockquote className={styles.blockquote}>{children}</blockquote>
          },

          // Headings
          h1({ children }) { return <h1 className={styles.h1}>{children}</h1> },
          h2({ children }) { return <h2 className={styles.h2}>{children}</h2> },
          h3({ children }) { return <h3 className={styles.h3}>{children}</h3> },

          // Lists
          ul({ children }) { return <ul className={styles.ul}>{children}</ul> },
          ol({ children }) { return <ol className={styles.ol}>{children}</ol> },
          li({ children }) { return <li className={styles.li}>{children}</li> },

          // Horizontal rule
          hr() { return <hr className={styles.hr} /> },

          // Paragraphs
          p({ children }) { return <p className={styles.p}>{children}</p> },

          // Strong/em
          strong({ children }) { return <strong className={styles.strong}>{children}</strong> },
          em({ children }) { return <em className={styles.em}>{children}</em> },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

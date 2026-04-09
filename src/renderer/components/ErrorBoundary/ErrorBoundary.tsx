import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#1e1e2e', color: '#cdd6f4', fontFamily: 'monospace', gap: 16, padding: 32,
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h2 style={{ margin: 0, color: '#f38ba8' }}>应用发生了一个错误</h2>
          <pre style={{
            background: '#181825', border: '1px solid #313244', borderRadius: 6,
            padding: '12px 16px', maxWidth: 600, overflowX: 'auto', fontSize: 12, color: '#fab387',
          }}>
            {this.state.error?.message || '未知错误'}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 20px', background: '#cba6f7', color: '#1e1e2e', border: 'none',
              borderRadius: 6, cursor: 'pointer', fontWeight: 600,
            }}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

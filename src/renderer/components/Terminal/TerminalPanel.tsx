import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { X } from 'lucide-react'
import 'xterm/css/xterm.css'
import styles from './TerminalPanel.module.css'

interface Props {
  rootPath?: string
  onClose: () => void
}

export default function TerminalPanel({ rootPath, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const termIdRef = useRef<string | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])

  const setupTerminal = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      theme: {
        background: '#11111b',
        foreground: '#cdd6f4',
        cursor: '#f5c2e7',
        selectionBackground: '#45475a',
        black: '#45475a', brightBlack: '#585b70',
        red: '#f38ba8',   brightRed: '#f38ba8',
        green: '#a6e3a1', brightGreen: '#a6e3a1',
        yellow: '#f9e2af', brightYellow: '#f9e2af',
        blue: '#89b4fa',  brightBlue: '#89b4fa',
        magenta: '#cba6f7', brightMagenta: '#cba6f7',
        cyan: '#94e2d5',  brightCyan: '#94e2d5',
        white: '#bac2de', brightWhite: '#a6adc8',
      },
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    const api = (window as any).electronAPI
    if (!api?.terminal) {
      term.writeln('\r\n\x1b[31m[Terminal] electronAPI.terminal not available\x1b[0m\r\n')
      return
    }

    const result = await api.terminal.create({
      cwd: rootPath || undefined,
      cols: term.cols,
      rows: term.rows,
    })

    if (!result?.success) {
      term.writeln(`\r\n\x1b[31m[Terminal] Failed to create: ${result?.error || 'unknown'}\x1b[0m\r\n`)
      return
    }

    const id = result.id
    termIdRef.current = id

    // Receive data from shell
    const offData = api.terminal.onData(id, (data: string) => term.write(data))
    const offExit = api.terminal.onExit(id, () => {
      term.writeln('\r\n\x1b[33m[Process exited]\x1b[0m')
      termIdRef.current = null
    })

    // Send user input to shell
    const dataDisposable = term.onData((input: string) => {
      api.terminal.write(id, input)
    })

    // Handle resize
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      api.terminal.resize(id, cols, rows)
    })

    cleanupRef.current.push(
      offData, offExit,
      () => dataDisposable.dispose(),
      () => resizeDisposable.dispose(),
      () => { if (termIdRef.current) api.terminal.destroy(termIdRef.current) },
    )
  }, [rootPath])

  useEffect(() => {
    setupTerminal()

    // Observe container size changes to fit terminal
    const observer = new ResizeObserver(() => {
      fitRef.current?.fit()
    })
    if (containerRef.current) observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      cleanupRef.current.forEach(fn => fn())
      cleanupRef.current = []
      termRef.current?.dispose()
      termRef.current = null
    }
  }, [])

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.title}>终端</span>
        <button className={styles.closeBtn} onClick={onClose} title="关闭终端">
          <X size={13} />
        </button>
      </div>
      <div ref={containerRef} className={styles.terminal} />
    </div>
  )
}

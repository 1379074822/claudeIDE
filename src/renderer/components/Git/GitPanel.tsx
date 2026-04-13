import { useState, useEffect, useCallback } from 'react'
import {
  GitBranch, RefreshCw, Plus, Minus, RotateCcw,
  ChevronDown, ChevronRight, GitCommit, Check, History, ChevronsUpDown,
} from 'lucide-react'
import { getAPI } from '../../utils/electronAPI'
import styles from './GitPanel.module.css'

const GIT_STATUS_COLORS: Record<string, string> = {
  M: '#e5c07b',
  A: '#98c379',
  U: '#61afef',
  D: '#e06c75',
  R: '#c678dd',
}

const GIT_STATUS_LABELS: Record<string, string> = {
  M: '已修改',
  A: '已添加',
  U: '未跟踪',
  D: '已删除',
  R: '已重命名',
}

interface FileStatus {
  path: string
  rel: string
  name: string
  status: string
}

interface CommitEntry {
  hash: string
  subject: string
  author: string
  date: string
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={styles.statusBadge}
      style={{ color: GIT_STATUS_COLORS[status] || '#a6adc8' }}
      title={GIT_STATUS_LABELS[status] || status}
    >
      {status}
    </span>
  )
}

export default function GitPanel({ rootPath }: { rootPath: string }) {
  const [branch, setBranch] = useState<string>('')
  const [branches, setBranches] = useState<string[]>([])
  const [showBranchPicker, setShowBranchPicker] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [changed, setChanged] = useState<FileStatus[]>([])
  const [staged, setStaged] = useState<Set<string>>(new Set())
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [commitSuccess, setCommitSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [commits, setCommits] = useState<CommitEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [changedCollapsed, setChangedCollapsed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!rootPath) return
    const api = getAPI()
    if (!api?.git) { setError('Git API 不可用'); return }
    setLoading(true)
    setError(null)
    try {
      const [branchRes, statusRes] = await Promise.all([
        api.git.branch(rootPath),
        api.git.status(rootPath),
      ])
      if (branchRes.success) setBranch(branchRes.branch)
      if (statusRes.success) {
        const sep = rootPath.includes('\\') ? '\\' : '/'
        const files: FileStatus[] = Object.entries(statusRes.statusMap).map(([abs, st]) => {
          const rel = abs.replace(rootPath + sep, '').replace(/\\/g, '/')
          const name = rel.split('/').pop() || rel
          return { path: abs, rel, name, status: st }
        })
        setChanged(files)
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [rootPath])

  useEffect(() => { refresh() }, [refresh])

  const loadBranches = useCallback(async () => {
    const api = getAPI()
    if (!api?.git) return
    const res = await api.git.branches(rootPath)
    if (res.success) setBranches(res.branches)
  }, [rootPath])

  const handleCheckout = async (target: string) => {
    if (target === branch) { setShowBranchPicker(false); return }
    const api = getAPI()
    if (!api?.git) return
    setCheckingOut(true)
    const res = await api.git.checkout(rootPath, target)
    setCheckingOut(false)
    setShowBranchPicker(false)
    if (res.success) await refresh()
    else setError(res.error || '切换分支失败')
  }

  const loadHistory = useCallback(async () => {
    if (!rootPath) return
    const api = getAPI()
    if (!api?.git) return
    setHistoryLoading(true)
    const res = await api.git.log(rootPath, 30)
    if (res.success) setCommits(res.commits)
    setHistoryLoading(false)
  }, [rootPath])

  useEffect(() => {
    if (showHistory) loadHistory()
  }, [showHistory, loadHistory])

  const toggleStage = async (file: FileStatus) => {
    const api = getAPI()
    if (!api?.git) return
    if (staged.has(file.rel)) {
      await api.git.unstage(rootPath, file.path)
      setStaged(prev => { const s = new Set(prev); s.delete(file.rel); return s })
    } else {
      await api.git.stage(rootPath, file.path)
      setStaged(prev => new Set(prev).add(file.rel))
    }
  }

  const handleStageAll = async () => {
    const api = getAPI()
    if (!api?.git) return
    await api.git.stageAll(rootPath)
    setStaged(new Set(changed.map(f => f.rel)))
  }

  const handleDiscard = async (file: FileStatus) => {
    if (file.status === 'U') return // Can't discard untracked
    const api = getAPI()
    if (!api?.git) return
    const ok = window.confirm(`放弃对 "${file.name}" 的修改？此操作不可撤销。`)
    if (!ok) return
    await api.git.discard(rootPath, file.path)
    setStaged(prev => { const s = new Set(prev); s.delete(file.rel); return s })
    await refresh()
  }

  const handleCommit = async () => {
    if (!commitMsg.trim() || staged.size === 0) return
    const api = getAPI()
    if (!api?.git) return
    setCommitting(true)
    setCommitError(null)
    const result = await api.git.commit(rootPath, commitMsg)
    if (result.success) {
      setCommitMsg('')
      setStaged(new Set())
      setCommitSuccess(true)
      setTimeout(() => setCommitSuccess(false), 2500)
      await refresh()
    } else {
      setCommitError(result.error || '提交失败')
    }
    setCommitting(false)
  }

  if (!rootPath) {
    return (
      <div className={styles.empty}>
        <GitBranch size={28} color="#45475a" />
        <p>未打开项目</p>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>SOURCE CONTROL</span>
        </div>
        <button className={styles.refreshBtn} onClick={refresh} title="刷新" disabled={loading}>
          <RefreshCw size={12} className={loading ? styles.spinning : ''} />
        </button>
      </div>

      {/* Branch switcher */}
      {branch && (
        <div className={styles.branchBar}>
          <button
            className={styles.branchBtn}
            onClick={() => { loadBranches(); setShowBranchPicker(v => !v) }}
            disabled={checkingOut}
            title="切换分支"
          >
            <GitBranch size={12} />
            <span>{checkingOut ? '切换中...' : branch}</span>
            <ChevronsUpDown size={11} />
          </button>
          {showBranchPicker && (
            <div className={styles.branchDropdown}>
              {branches.map(b => (
                <button
                  key={b}
                  className={`${styles.branchItem} ${b === branch ? styles.branchItemActive : ''}`}
                  onClick={() => handleCheckout(b)}
                >
                  <GitBranch size={11} />
                  <span>{b}</span>
                  {b === branch && <Check size={11} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && !error.includes('not a git') && (
        <div className={styles.error}>{error}</div>
      )}

      {error?.includes('not a git') ? (
        <div className={styles.noGit}>
          <GitBranch size={24} color="#45475a" />
          <p>当前项目不是 Git 仓库</p>
        </div>
      ) : (
        <>
          {/* Changed files */}
          <div className={styles.section}>
            <div className={styles.sectionHeader} onClick={() => setChangedCollapsed(v => !v)}>
              {changedCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <span>已更改 ({changed.length})</span>
              {changed.length > 0 && (
                <button
                  className={styles.stageAllBtn}
                  onClick={e => { e.stopPropagation(); handleStageAll() }}
                  title="暂存全部"
                >
                  <Plus size={11} />全部暂存
                </button>
              )}
            </div>

            {!changedCollapsed && (
              <div className={styles.fileList}>
                {changed.length === 0 ? (
                  <div className={styles.noChanges}>✓ 没有未保存的更改</div>
                ) : (
                  changed.map(file => (
                    <div key={file.rel} className={styles.fileRow}>
                      <button
                        className={`${styles.stageBtn} ${staged.has(file.rel) ? styles.staged : ''}`}
                        onClick={() => toggleStage(file)}
                        title={staged.has(file.rel) ? '取消暂存' : '暂存此文件'}
                      >
                        {staged.has(file.rel) ? <Minus size={10} /> : <Plus size={10} />}
                      </button>
                      <StatusBadge status={file.status} />
                      <span
                        className={styles.fileName}
                        title={file.rel}
                        style={{
                          color: staged.has(file.rel)
                            ? 'var(--text)'
                            : GIT_STATUS_COLORS[file.status] || 'var(--text-secondary)',
                        }}
                      >
                        {file.name}
                      </span>
                      <span className={styles.fileDir}>
                        {file.rel.includes('/') ? file.rel.slice(0, file.rel.lastIndexOf('/')) : ''}
                      </span>
                      {file.status !== 'U' && (
                        <button
                          className={styles.discardBtn}
                          onClick={() => handleDiscard(file)}
                          title="放弃更改"
                        >
                          <RotateCcw size={10} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Staged summary */}
          {staged.size > 0 && (
            <div className={styles.stagedBadge}>
              <Check size={11} /> {staged.size} 个文件已暂存，待提交
            </div>
          )}

          {/* Commit area */}
          <div className={styles.commitArea}>
            <textarea
              className={styles.commitInput}
              placeholder={staged.size === 0 ? '先暂存文件，然后输入提交信息...' : '提交信息 (Ctrl+Enter 提交)'}
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit()
              }}
              rows={3}
              disabled={staged.size === 0}
            />
            {commitError && <div className={styles.commitError}>{commitError}</div>}
            {commitSuccess && (
              <div className={styles.commitSuccess}>
                <Check size={12} /> 提交成功！
              </div>
            )}
            <button
              className={styles.commitBtn}
              onClick={handleCommit}
              disabled={!commitMsg.trim() || staged.size === 0 || committing}
            >
              <GitCommit size={13} />
              {committing ? '提交中...' : `提交 (${staged.size} 个文件)`}
            </button>
          </div>

          {/* Commit history toggle */}
          <div className={styles.historyToggle} onClick={() => setShowHistory(v => !v)}>
            <History size={12} />
            <span>提交历史</span>
            {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>

          {showHistory && (
            <div className={styles.historyList}>
              {historyLoading ? (
                <div className={styles.noChanges}>加载中...</div>
              ) : commits.length === 0 ? (
                <div className={styles.noChanges}>无提交记录</div>
              ) : (
                commits.map(c => (
                  <div key={c.hash} className={styles.commitCard}>
                    <div className={styles.commitTop}>
                      <span className={styles.commitHash}>{c.hash.slice(0, 7)}</span>
                      <span className={styles.commitDate}>{c.date}</span>
                    </div>
                    <div className={styles.commitSubject}>{c.subject}</div>
                    <div className={styles.commitAuthor}>{c.author}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

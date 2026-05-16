import { useState, useRef, useCallback } from 'react'
import styles from './FileDropZone.module.css'

interface QueuedFile {
  file:   File
  prompt: string
  status: 'waiting' | 'analyzing' | 'done' | 'error'
  error?: string
}

interface Props {
  isAnalyzing: boolean
  onAnalyze:   (file: File, prompt: string) => void
  onClose?:    () => void
}

export function FileDropZone({ isAnalyzing, onAnalyze, onClose }: Props) {
  const [queue,      setQueue]      = useState<QueuedFile[]>([])
  const [dragging,   setDragging]   = useState(false)
  const [globalPrompt, setGlobalPrompt] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const ACCEPTED = '.pdf,.docx,.txt,.md,.csv'

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    setQueue(prev => [
      ...prev,
      ...arr.map(f => ({ file: f, prompt: globalPrompt, status: 'waiting' as const })),
    ])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }, [globalPrompt])

  function removeFromQueue(idx: number) {
    setQueue(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePrompt(idx: number, prompt: string) {
    setQueue(prev => prev.map((q, i) => i === idx ? { ...q, prompt } : q))
  }

  function analyzeFile(idx: number) {
    const item = queue[idx]
    if (!item || item.status === 'analyzing') return
    setQueue(prev => prev.map((q, i) => i === idx ? { ...q, status: 'analyzing' } : q))
    onAnalyze(item.file, item.prompt || globalPrompt)
    // Mark as done after a tick (actual status tracked by parent)
    setTimeout(() => {
      setQueue(prev => prev.map((q, i) => i === idx ? { ...q, status: 'done' } : q))
    }, 500)
  }

  function analyzeAll() {
    queue.forEach((_, idx) => analyzeFile(idx))
  }

  const pendingCount = queue.filter(q => q.status === 'waiting').length

  return (
    <div className={styles.wrap}>

      {/* Global prompt */}
      <div className={styles.promptRow}>
        <input
          className={styles.promptInput}
          placeholder="Instructions for all files (e.g. organize by question and solution, summarize by chapter...)"
          value={globalPrompt}
          onChange={e => setGlobalPrompt(e.target.value)}
        />
      </div>

      {/* Drop zone */}
      <div
        className={`${styles.dropZone} ${dragging ? styles.dragging : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <span className={styles.dropIcon}>📂</span>
        <span className={styles.dropText}>
          {dragging ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
        </span>
        <small className={styles.dropSub}>PDF · DOCX · TXT · MD · CSV</small>
        <input
          ref={fileRef} type="file" style={{ display:'none' }}
          accept={ACCEPTED} multiple
          onChange={e => { if (e.target.files) addFiles(e.target.files) }}
        />
      </div>

      {/* File queue */}
      {queue.length > 0 && (
        <div className={styles.queue}>
          {queue.map((item, idx) => (
            <div key={idx} className={`${styles.queueItem} ${styles[`status_${item.status}`]}`}>
              <div className={styles.queueLeft}>
                <span className={styles.fileIcon}>
                  {item.status === 'done'      ? '✅'
                  : item.status === 'error'    ? '❌'
                  : item.status === 'analyzing'? '⟳'
                  : '📄'}
                </span>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{item.file.name}</span>
                  <span className={styles.fileSize}>{(item.file.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>

              <input
                className={styles.itemPrompt}
                placeholder="Specific instructions for this file (optional)..."
                value={item.prompt}
                onChange={e => updatePrompt(idx, e.target.value)}
                onClick={e => e.stopPropagation()}
              />

              <div className={styles.queueActions}>
                {item.status === 'waiting' && (
                  <button
                    className={styles.analyzeBtn}
                    onClick={e => { e.stopPropagation(); analyzeFile(idx) }}
                    disabled={isAnalyzing}
                  >
                    Analyze
                  </button>
                )}
                {item.status === 'done' && <span className={styles.doneLabel}>Done</span>}
                {item.status === 'analyzing' && <span className={styles.analyzingLabel}>Analyzing...</span>}
                <button
                  className={styles.removeBtn}
                  onClick={e => { e.stopPropagation(); removeFromQueue(idx) }}
                  title="Remove from queue"
                >✕</button>
              </div>
            </div>
          ))}

          {pendingCount > 1 && (
            <button
              className={styles.analyzeAllBtn}
              onClick={analyzeAll}
              disabled={isAnalyzing}
            >
              ⚙ Analyze all {pendingCount} files
            </button>
          )}
        </div>
      )}

      {onClose && (
        <button className={styles.closeBtn} onClick={onClose}>
          ✕ Close
        </button>
      )}
    </div>
  )
}

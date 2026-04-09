import { useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { useModelStore, type ModelProfile } from '../../store'
import styles from './ModelManager.module.css'

export default function ModelManager() {
  const { models, defaultApiKey, defaultBaseURL, addModel, removeModel, setDefaultApiKey, setDefaultBaseURL } = useModelStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '', modelId: '', apiKey: '', baseURL: '', description: '',
  })

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.modelId.trim()) return
    const newModel: ModelProfile = {
      id: Date.now().toString(),
      name: formData.name,
      modelId: formData.modelId,
      apiKey: formData.apiKey || undefined,
      baseURL: formData.baseURL || undefined,
      description: formData.description || undefined,
    }
    addModel(newModel)
    setFormData({ name: '', modelId: '', apiKey: '', baseURL: '', description: '' })
    setShowAddForm(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Default Config</div>
        <div className={styles.field}>
          <label>API Key</label>
          <input
            type="password"
            value={defaultApiKey}
            onChange={e => setDefaultApiKey(e.target.value)}
            className={styles.input}
            placeholder="sk-ant-..."
          />
        </div>
        <div className={styles.field}>
          <label>Base URL</label>
          <input
            type="text"
            value={defaultBaseURL}
            onChange={e => setDefaultBaseURL(e.target.value)}
            className={styles.input}
            placeholder="https://api.anthropic.com"
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Models</div>
          <button className={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={14} />
          </button>
        </div>

        {showAddForm && (
          <div className={styles.addForm}>
            <input
              type="text"
              placeholder="Name (e.g. GPT-4)"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Model ID (e.g. gpt-4)"
              value={formData.modelId}
              onChange={e => setFormData({ ...formData, modelId: e.target.value })}
              className={styles.input}
            />
            <input
              type="password"
              placeholder="API Key (optional)"
              value={formData.apiKey}
              onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Base URL (optional)"
              value={formData.baseURL}
              onChange={e => setFormData({ ...formData, baseURL: e.target.value })}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className={styles.input}
            />
            <button className={styles.saveBtn} onClick={handleAdd}>
              <Check size={14} /> Add Model
            </button>
          </div>
        )}

        <div className={styles.modelList}>
          {models.map(m => (
            <div key={m.id} className={styles.modelItem}>
              <div className={styles.modelInfo}>
                <div className={styles.modelName}>{m.name}</div>
                <div className={styles.modelId}>{m.modelId}</div>
                {m.description && <div className={styles.modelDesc}>{m.description}</div>}
                {m.apiKey && <div className={styles.modelBadge}>Custom API</div>}
              </div>
              <button className={styles.deleteBtn} onClick={() => removeModel(m.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

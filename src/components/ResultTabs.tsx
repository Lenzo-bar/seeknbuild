import styles from './ResultTabs.module.css'

export type TabId = 'web' | 'llm' | 'file' | 'webonly' | 'urls' | 'all'

export interface TabConfig {
  id:       TabId
  label:    string
  count:    number
  color:    'blue' | 'teal' | 'amber' | 'purple' | 'amber2' | 'violet'
  icon:     string
}

interface Props {
  activeTab:  TabId
  tabs:       TabConfig[]
  onChange:   (tab: TabId) => void
}

export function ResultTabs({ activeTab, tabs, onChange }: Props) {
  return (
    <div className={styles.strip} role="tablist" aria-label="Result tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`${styles.tab} ${styles[`tab_${tab.color}`]} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className={styles.tabIcon}>{tab.icon}</span>
          <span className={styles.tabLabel}>{tab.label}</span>
          {tab.count > 0 && (
            <span className={`${styles.badge} ${styles[`badge_${tab.color}`]}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
      <div className={styles.borderFill} />
    </div>
  )
}

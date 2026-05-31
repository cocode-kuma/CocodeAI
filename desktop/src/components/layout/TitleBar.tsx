import { useUIStore } from '../../stores/uiStore'
import { useTranslation } from '../../i18n'
import { useTabStore, SETTINGS_TAB_ID } from '../../stores/tabStore'

export function TitleBar() {
  const { activeView, setActiveView } = useUIStore()
  const t = useTranslation()

  return (
    <div
      className="h-[var(--titlebar-height)] flex items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] select-none"
      data-tauri-drag-region
    >
      {/* macOS traffic light spacer */}
      <div className="w-[78px] flex-shrink-0" data-tauri-drag-region />

      {/* Logo */}
      <div className="flex items-center gap-2 mr-6" data-tauri-drag-region>
        <span className="text-xs font-bold tracking-widest text-[var(--color-brand)] uppercase" style={{ letterSpacing: '0.12em' }}>cocodeAI</span>
      </div>

      {/* Center tabs — 顺序：历史 → 代码 → 终端（最常用在中间） */}
      <div className="flex-1 flex items-center justify-center" data-tauri-drag-region>
        <div className="flex items-center gap-0.5 bg-[var(--color-surface-container)] rounded-[var(--radius-lg)] p-1">
          <TabButton active={activeView === 'history'} onClick={() => setActiveView('history')} icon="history">
            {t('titlebar.history')}
          </TabButton>
          <TabButton active={activeView === 'code'} onClick={() => setActiveView('code')} icon="code">
            {t('titlebar.code')}
          </TabButton>
          <TabButton active={activeView === 'terminal'} onClick={() => setActiveView('terminal')} icon="terminal">
            {t('titlebar.terminal')}
          </TabButton>
        </div>
      </div>

      {/* Right: Settings */}
      <div className="flex items-center gap-2 mr-4">
        <button
          onClick={() => useTabStore.getState().openTab(SETTINGS_TAB_ID, '设置', 'settings')}
          className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          title="设置"
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
        </button>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)] transition-all duration-200
        ${active
          ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
        }
      `}
    >
      <span className="material-symbols-outlined text-[15px]">{icon}</span>
      {children}
    </button>
  )
}

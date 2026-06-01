import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useChatStore } from '../../stores/chatStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { useTranslation } from '../../i18n'

type Props = { sessionId: string }

type ElementSelected = {
  outerHTML: string
  selector: string
  text: string
  rect: string
}

const LOCAL_RE = /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|file:\/\/)/i

function isLocal(url: string) { return LOCAL_RE.test(url) }

function isDangerous(url: string) {
  try {
    const { protocol } = new URL(url)
    return !['http:', 'https:', 'file:'].includes(protocol)
  } catch { return true }
}

export function BrowserPanel({ sessionId }: Props) {
  const t = useTranslation()
  const setBrowserUrl = useWorkspacePanelStore((s) => s.setBrowserUrl)
  const browserUrl = useWorkspacePanelStore(
    (s) => s.panelBySession[sessionId]?.browserUrl ?? '',
  )
  const queueComposerPrefill = useChatStore((s) => s.queueComposerPrefill)

  const [addressInput, setAddressInput] = useState(browserUrl)
  const [urlError, setUrlError] = useState(false)
  const [inspectorActive, setInspectorActive] = useState(false)
  const [pickedEl, setPickedEl] = useState<ElementSelected | null>(null)
  const [descInput, setDescInput] = useState('')
  const holderRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)

  // Sync address bar when store changes (e.g. auto-detected URL)
  useEffect(() => { setAddressInput(browserUrl) }, [browserUrl])

  // Open / update native webview whenever url or panel bounds change
  const syncWebview = useCallback(async (url: string) => {
    if (!holderRef.current) return
    const rect = holderRef.current.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const x = Math.round(rect.left * dpr)
    const y = Math.round(rect.top * dpr)
    const w = Math.round(rect.width * dpr)
    const h = Math.round(rect.height * dpr)
    if (!openRef.current) {
      await invoke('browser_open', { url, x, y, width: w, height: h })
      openRef.current = true
    } else {
      await invoke('browser_navigate', { url })
      await invoke('browser_set_bounds', { x, y, width: w, height: h })
    }
  }, [])

  // Open on mount / url change
  useEffect(() => {
    if (!browserUrl) return
    void syncWebview(browserUrl)
  }, [browserUrl, syncWebview])

  // Resize observer — keep native webview in sync
  useEffect(() => {
    const el = holderRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (openRef.current && browserUrl) void syncWebview(browserUrl)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [browserUrl, syncWebview])

  // Close native webview on unmount
  useEffect(() => () => {
    if (openRef.current) {
      void invoke('browser_close')
      openRef.current = false
    }
  }, [])

  // Listen for element-selected events from inspector script
  useEffect(() => {
    const unlisten = listen<ElementSelected>('element_selected', (e) => {
      setPickedEl(e.payload)
      setInspectorActive(false)
    })
    return () => { void unlisten.then((fn) => fn()) }
  }, [])

  const navigate = (url: string) => {
    if (isDangerous(url)) { setUrlError(true); return }
    setUrlError(false)
    setBrowserUrl(sessionId, url)
  }

  const toggleInspector = async () => {
    const next = !inspectorActive
    setInspectorActive(next)
    setPickedEl(null)
    await invoke('browser_inspector_set_active', { active: next })
  }

  const captureFullPage = async () => {
    try {
      const data = await invoke<string>('browser_screenshot')
      queueComposerPrefill(sessionId, {
        text: '',
        attachments: [{ type: 'image', name: t('browser.screenshotLabel'), data, mimeType: 'image/png' }],
      })
    } catch {
      // toast handled by caller
    }
  }

  const sendElementRequest = () => {
    if (!pickedEl || !descInput.trim()) return
    const prompt = [
      t('browser.elementPromptHeader'),
      `元素：${pickedEl.outerHTML.slice(0, 400)}`,
      `选择器：${pickedEl.selector}`,
      `来源：${browserUrl}`,
      '',
      `修改需求：${descInput}`,
    ].join('\n')
    queueComposerPrefill(sessionId, { text: prompt })
    setPickedEl(null)
    setDescInput('')
  }

  const iconBtn = 'inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none'

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--color-border)] px-2 py-1.5">
        <button className={iconBtn} onClick={() => invoke('browser_navigate', { url: 'about:blank' }).then(() => navigate(browserUrl))} aria-label="Refresh">
          <span className="material-symbols-outlined text-[16px]">refresh</span>
        </button>

        {/* Address bar */}
        <div className={`flex flex-1 items-center rounded-[8px] border px-2.5 h-7 text-[12px] transition-colors ${urlError ? 'border-[var(--color-error)] bg-[var(--color-error)]/8' : 'border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] focus-within:border-[var(--color-border-focus)]'}`}>
          {!isLocal(addressInput) && addressInput && (
            <span className="material-symbols-outlined mr-1 text-[13px] text-[var(--color-text-tertiary)]">public</span>
          )}
          <input
            className="min-w-0 flex-1 bg-transparent text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            value={addressInput}
            onChange={(e) => { setAddressInput(e.target.value); setUrlError(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(addressInput) }}
            onFocus={(e) => e.target.select()}
            placeholder="localhost:3000"
            spellCheck={false}
          />
        </div>

        {/* Screenshot full page */}
        <button className={iconBtn} onClick={captureFullPage} aria-label={t('browser.screenshotFull')}>
          <span className="material-symbols-outlined text-[16px]">screenshot</span>
        </button>

        {/* Inspector toggle — only useful for local */}
        <button
          className={`${iconBtn} ${inspectorActive ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]' : ''}`}
          onClick={toggleInspector}
          aria-label={t('browser.inspectorToggle')}
          disabled={!isLocal(browserUrl)}
          title={isLocal(browserUrl) ? undefined : t('browser.inspectorLocalOnly')}
        >
          <span className="material-symbols-outlined text-[16px]">frame_inspect</span>
        </button>
      </div>

      {/* Native webview placeholder — Rust positions the child window over this */}
      <div ref={holderRef} className="relative min-h-0 flex-1 bg-[var(--color-surface-container-lowest)]">
        {!browserUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-[32px]">travel_explore</span>
            <span className="text-sm">{t('browser.emptyHint')}</span>
          </div>
        )}
      </div>

      {/* Element picker overlay */}
      {pickedEl && (
        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-container)] px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-[13px]">frame_inspect</span>
            <code className="truncate font-mono">{pickedEl.selector}</code>
            <button className="ml-auto" onClick={() => setPickedEl(null)} aria-label="Dismiss">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-2.5 py-1.5 text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
              placeholder={t('browser.descPlaceholder')}
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendElementRequest() }}
              autoFocus
            />
            <button
              className="shrink-0 rounded-[8px] bg-[var(--color-brand)] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
              disabled={!descInput.trim()}
              onClick={sendElementRequest}
            >
              {t('browser.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

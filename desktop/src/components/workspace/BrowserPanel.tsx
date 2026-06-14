import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useChatStore } from '../../stores/chatStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { useTranslation } from '../../i18n'
import { isLocalPreviewUrl, normalizeWorkspaceOpenTarget } from '../../utils/workspaceOpenTarget'

type Props = { sessionId: string }

type BrowserElementAncestor = {
  tagName: string
  selector: string
  text?: string
  role?: string
  className?: string
}

type BrowserElementSelection = {
  url: string
  title: string
  selector: string
  cssPath: string
  xpath?: string
  tagName: string
  id?: string
  className?: string
  text: string
  attributes: Record<string, string>
  outerHTML: string
  innerHTML: string
  rect: { x: number; y: number; width: number; height: number }
  ancestry: BrowserElementAncestor[]
}

const iconBtn = 'inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40'

function formatAddressInput(rawUrl: string) {
  if (!rawUrl) return ''
  try {
    const url = new URL(rawUrl)
    if (url.protocol === 'file:') return decodeURIComponent(url.pathname)
    return rawUrl
  } catch {
    return rawUrl
  }
}

function buildElementPrompt(selection: BrowserElementSelection, request: string) {
  const ancestry = selection.ancestry
    .map((item, index) => {
      const text = item.text ? ` text="${item.text.slice(0, 80)}"` : ''
      const role = item.role ? ` role="${item.role}"` : ''
      const className = item.className ? ` class="${item.className.slice(0, 120)}"` : ''
      return `${index + 1}. ${item.selector}${role}${className}${text}`
    })
    .join('\n')

  const attrs = Object.entries(selection.attributes)
    .slice(0, 20)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')

  return [
    'Browser DOM edit request',
    '',
    `Page: ${selection.url}`,
    `Title: ${selection.title || '(untitled)'}`,
    '',
    'Selected element:',
    `selector: ${selection.selector}`,
    `cssPath: ${selection.cssPath}`,
    selection.xpath ? `xpath: ${selection.xpath}` : '',
    `tag: ${selection.tagName}`,
    selection.id ? `id: ${selection.id}` : '',
    selection.className ? `class: ${selection.className}` : '',
    selection.text ? `text: ${selection.text}` : '',
    '',
    'Bounds:',
    `x=${Math.round(selection.rect.x)} y=${Math.round(selection.rect.y)} width=${Math.round(selection.rect.width)} height=${Math.round(selection.rect.height)}`,
    '',
    attrs ? `Attributes:\n${attrs}` : '',
    ancestry ? `DOM ancestry:\n${ancestry}` : '',
    '',
    'Selected HTML:',
    '```html',
    selection.outerHTML.slice(0, 4000),
    '```',
    '',
    'User request:',
    request.trim(),
  ].filter((line) => line !== '').join('\n')
}

export function BrowserPanel({ sessionId }: Props) {
  const t = useTranslation()
  const browserUrl = useWorkspacePanelStore(
    (s) => s.panelBySession[sessionId]?.browserUrl ?? '',
  )
  const setBrowserUrl = useWorkspacePanelStore((s) => s.setBrowserUrl)
  const queueComposerPrefill = useChatStore((s) => s.queueComposerPrefill)

  const [addressInput, setAddressInput] = useState(formatAddressInput(browserUrl))
  const [urlError, setUrlError] = useState<string | null>(null)
  const [inspectorActive, setInspectorActive] = useState(false)
  const [selection, setSelection] = useState<BrowserElementSelection | null>(null)
  const [descInput, setDescInput] = useState('')
  const [sending, setSending] = useState(false)
  const holderRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)

  const localInspectable = useMemo(() => isLocalPreviewUrl(browserUrl), [browserUrl])

  useEffect(() => {
    setAddressInput(formatAddressInput(browserUrl))
    setUrlError(null)
  }, [browserUrl])

  const syncWebview = useCallback(async (url: string) => {
    if (!holderRef.current) return
    const rect = holderRef.current.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const x = Math.round(rect.left * dpr)
    const y = Math.round(rect.top * dpr)
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))

    if (!openRef.current) {
      await invoke('browser_open', { url, x, y, width, height })
      openRef.current = true
      return
    }

    await invoke('browser_navigate', { url })
    await invoke('browser_set_bounds', { x, y, width, height })
  }, [])

  useEffect(() => {
    if (!browserUrl) return
    void syncWebview(browserUrl)
  }, [browserUrl, syncWebview])

  useEffect(() => {
    const el = holderRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (openRef.current && browserUrl) void syncWebview(browserUrl)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [browserUrl, syncWebview])

  useEffect(() => () => {
    if (openRef.current) {
      void invoke('browser_close')
      openRef.current = false
    }
  }, [])

  useEffect(() => {
    const unlisten = listen<BrowserElementSelection>('browser_element_selected', (event) => {
      setSelection(event.payload)
      setInspectorActive(false)
      setDescInput('')
    })
    return () => { void unlisten.then((fn) => fn()) }
  }, [])

  const navigate = useCallback((rawUrl: string) => {
    const target = normalizeWorkspaceOpenTarget(rawUrl)
    if (target.kind !== 'browser') {
      setUrlError(t('browser.invalidTarget'))
      return
    }
    setUrlError(null)
    setSelection(null)
    setBrowserUrl(sessionId, target.value)
  }, [sessionId, setBrowserUrl, t])

  const refresh = useCallback(async () => {
    if (!browserUrl) return
    await invoke('browser_navigate', { url: 'about:blank' }).catch(() => undefined)
    await invoke('browser_navigate', { url: browserUrl })
  }, [browserUrl])

  const toggleInspector = useCallback(async () => {
    if (!localInspectable) return
    const next = !inspectorActive
    setInspectorActive(next)
    setSelection(null)
    await invoke('browser_inspector_set_active', { active: next })
  }, [inspectorActive, localInspectable])

  const selectParent = useCallback(async () => {
    if (!selection) return
    await invoke('browser_inspector_select_parent')
  }, [selection])

  const capturePage = useCallback(async () => {
    try {
      const data = await invoke<string>('browser_screenshot')
      queueComposerPrefill(sessionId, {
        text: '',
        attachments: [{
          type: 'image',
          name: t('browser.screenshotLabel'),
          data,
          mimeType: 'image/png',
        }],
      })
      setUrlError(null)
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : String(error))
    }
  }, [queueComposerPrefill, sessionId, t])

  const sendElementRequest = useCallback(async () => {
    if (!selection || !descInput.trim()) return
    setSending(true)
    try {
      let screenshot: string | null = null
      try {
        screenshot = await invoke<string>('browser_screenshot')
      } catch {
        screenshot = null
      }
      queueComposerPrefill(sessionId, {
        text: buildElementPrompt(selection, descInput),
        attachments: screenshot ? [{
          type: 'image',
          name: t('browser.elementScreenshotLabel'),
          data: screenshot,
          mimeType: 'image/png',
        }] : undefined,
      })
      setSelection(null)
      setDescInput('')
    } finally {
      setSending(false)
    }
  }, [descInput, queueComposerPrefill, selection, sessionId, t])

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--color-border)] px-2 py-1.5">
        <button className={iconBtn} onClick={() => void refresh()} aria-label={t('browser.refresh')}>
          <span className="material-symbols-outlined text-[16px]">refresh</span>
        </button>

        <div className={`flex h-7 flex-1 items-center rounded-[8px] border px-2.5 text-[12px] transition-colors ${urlError ? 'border-[var(--color-error)] bg-[var(--color-error)]/8' : 'border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] focus-within:border-[var(--color-border-focus)]'}`}>
          <span className="material-symbols-outlined mr-1 text-[13px] text-[var(--color-text-tertiary)]">
            {localInspectable ? 'travel_explore' : 'public'}
          </span>
          <input
            className="min-w-0 flex-1 bg-transparent text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            value={addressInput}
            onChange={(event) => {
              setAddressInput(event.target.value)
              setUrlError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') navigate(addressInput)
            }}
            onFocus={(event) => event.target.select()}
            placeholder="http://localhost:3000"
            spellCheck={false}
          />
        </div>

        <button className={iconBtn} onClick={() => void capturePage()} aria-label={t('browser.screenshotFull')}>
          <span className="material-symbols-outlined text-[16px]">screenshot</span>
        </button>

        <button
          className={`${iconBtn} ${inspectorActive ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]' : ''}`}
          onClick={() => void toggleInspector()}
          aria-label={t('browser.inspectorToggle')}
          disabled={!localInspectable}
          title={localInspectable ? undefined : t('browser.inspectorLocalOnly')}
        >
          <span className="material-symbols-outlined text-[16px]">frame_inspect</span>
        </button>
      </div>

      {urlError && (
        <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-1.5 text-[11px] text-[var(--color-error)]">
          {urlError}
        </div>
      )}

      <div ref={holderRef} className="relative min-h-0 flex-1 bg-[var(--color-surface-container-lowest)]">
        {!browserUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-[32px]">travel_explore</span>
            <span className="text-sm">{t('browser.emptyHint')}</span>
          </div>
        )}
      </div>

      {selection && (
        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-container)] px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined text-[13px]">frame_inspect</span>
            <code className="truncate font-mono">{selection.selector}</code>
            <button
              className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-[5px] hover:bg-[var(--color-surface-hover)]"
              onClick={() => setSelection(null)}
              aria-label={t('browser.dismissSelection')}
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
          <div className="mb-2 flex items-center gap-2 text-[12px]">
            <span className="shrink-0 rounded-[5px] border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--color-text-tertiary)]">
              {selection.tagName.toLowerCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]">
              {selection.text || selection.className || selection.title || selection.url}
            </span>
            <button
              type="button"
              onClick={() => void selectParent()}
              className="shrink-0 rounded-[6px] border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              {t('browser.selectParent')}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-2.5 py-1.5 text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
              placeholder={t('browser.descPlaceholder')}
              value={descInput}
              onChange={(event) => setDescInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void sendElementRequest()
              }}
              autoFocus
            />
            <button
              className="shrink-0 rounded-[8px] bg-[var(--color-brand)] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
              disabled={!descInput.trim() || sending}
              onClick={() => void sendElementRequest()}
            >
              {sending ? t('browser.sending') : t('browser.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

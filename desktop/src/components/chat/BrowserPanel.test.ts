/**
 * Tests for the browser panel feature:
 * 1. extractDetectedUrls — URL detection from assistant messages
 * 2. workspacePanelStore — openBrowser / setBrowserUrl
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { extractDetectedUrls } from '../../utils/extractDetectedUrls'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'

// ── extractDetectedUrls ───────────────────────────────────────────────────────

describe('extractDetectedUrls', () => {
  it('detects localhost URL', () => {
    expect(extractDetectedUrls('App running at http://localhost:3000')).toEqual(['http://localhost:3000'])
  })

  it('detects 127.0.0.1 URL', () => {
    expect(extractDetectedUrls('Visit http://127.0.0.1:8080/dashboard')).toEqual(['http://127.0.0.1:8080/dashboard'])
  })

  it('detects local .html file path', () => {
    expect(extractDetectedUrls('Open /tmp/project/index.html to preview')).toEqual(['/tmp/project/index.html'])
  })

  it('detects local .md file path', () => {
    expect(extractDetectedUrls('See /home/user/README.md for details')).toEqual(['/home/user/README.md'])
  })

  it('deduplicates repeated URLs', () => {
    expect(extractDetectedUrls('http://localhost:3000 and again http://localhost:3000')).toHaveLength(1)
  })

  it('caps at 3 results', () => {
    const content = 'http://localhost:3000 http://localhost:3001 http://localhost:3002 http://localhost:3003'
    expect(extractDetectedUrls(content)).toHaveLength(3)
  })

  it('ignores external URLs', () => {
    expect(extractDetectedUrls('Visit https://example.com for docs')).toEqual([])
  })

  it('returns empty for plain text', () => {
    expect(extractDetectedUrls('No URLs here at all')).toEqual([])
  })

  it('does not include non-html/md file paths', () => {
    expect(extractDetectedUrls('File at /tmp/data.json')).toEqual([])
  })
})

// ── workspacePanelStore — browser actions ─────────────────────────────────────

describe('workspacePanelStore browser actions', () => {
  const SESSION = 'test-session-browser'

  beforeEach(() => {
    useWorkspacePanelStore.setState((s) => ({
      panelBySession: { ...s.panelBySession, [SESSION]: undefined },
    }))
  })

  it('openBrowser sets view to browser, isOpen=true, and stores url', () => {
    useWorkspacePanelStore.getState().openBrowser(SESSION, 'http://localhost:3000')
    const panel = useWorkspacePanelStore.getState().panelBySession[SESSION]
    expect(panel?.activeView).toBe('browser')
    expect(panel?.isOpen).toBe(true)
    expect(panel?.browserUrl).toBe('http://localhost:3000')
  })

  it('setBrowserUrl updates url without changing view', () => {
    useWorkspacePanelStore.getState().openBrowser(SESSION, 'http://localhost:3000')
    useWorkspacePanelStore.getState().setBrowserUrl(SESSION, 'http://localhost:3001')
    const panel = useWorkspacePanelStore.getState().panelBySession[SESSION]
    expect(panel?.browserUrl).toBe('http://localhost:3001')
    expect(panel?.activeView).toBe('browser')
  })

  it('setActiveView to browser works', () => {
    useWorkspacePanelStore.getState().setActiveView(SESSION, 'browser')
    expect(useWorkspacePanelStore.getState().getActiveView(SESSION)).toBe('browser')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserPanel } from './BrowserPanel'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'

const invokeMock = vi.fn()
let eventHandlers: Record<string, (event: { payload: unknown }) => void> = {}

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, handler: (event: { payload: unknown }) => void) => {
    eventHandlers[event] = handler
    return Promise.resolve(() => {
      delete eventHandlers[event]
    })
  },
}))

const SESSION = 'browser-session'

function resetStores() {
  useSettingsStore.setState({ locale: 'en' })
  useWorkspacePanelStore.setState(useWorkspacePanelStore.getInitialState(), true)
  useChatStore.setState({
    sessions: {
      [SESSION]: useChatStore.getState().getSession(SESSION),
    },
  })
}

describe('BrowserPanel', () => {
  beforeEach(() => {
    eventHandlers = {}
    invokeMock.mockReset()
    invokeMock.mockImplementation((command) => {
      if (command === 'browser_screenshot') return Promise.resolve('data:image/png;base64,test')
      return Promise.resolve(undefined)
    })
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
    resetStores()
    useWorkspacePanelStore.getState().openBrowser(SESSION, 'http://localhost:3000')
  })

  it('prefills an image attachment when screenshot is clicked', async () => {
    render(<BrowserPanel sessionId={SESSION} />)

    fireEvent.click(screen.getByRole('button', { name: 'Screenshot page' }))

    await waitFor(() => {
      const prefill = useChatStore.getState().sessions[SESSION]?.composerPrefill
      expect(prefill?.attachments?.[0]?.data).toBe('data:image/png;base64,test')
      expect(prefill?.attachments?.[0]?.mimeType).toBe('image/png')
    })
  })

  it('turns a selected DOM element into a structured composer prefill', async () => {
    render(<BrowserPanel sessionId={SESSION} />)

    await waitFor(() => {
      expect(eventHandlers.browser_element_selected).toBeTruthy()
    })

    act(() => {
      eventHandlers.browser_element_selected?.({
        payload: {
          url: 'http://localhost:3000',
          title: 'Preview',
          selector: 'button.primary',
          cssPath: 'main > button.primary',
          xpath: '/main[1]/button[1]',
          tagName: 'BUTTON',
          id: '',
          className: 'primary',
          text: 'Publish',
          attributes: { class: 'primary' },
          outerHTML: '<button class="primary">Publish</button>',
          innerHTML: 'Publish',
          rect: { x: 10, y: 20, width: 80, height: 32 },
          ancestry: [
            { tagName: 'MAIN', selector: 'main', text: 'Publish' },
            { tagName: 'BUTTON', selector: 'button.primary', text: 'Publish', className: 'primary' },
          ],
        },
      })
    })

    fireEvent.change(screen.getByPlaceholderText('Describe the change, press Enter to send…'), {
      target: { value: 'Make it orange' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      const prefill = useChatStore.getState().sessions[SESSION]?.composerPrefill
      expect(prefill?.text).toContain('Browser DOM edit request')
      expect(prefill?.text).toContain('selector: button.primary')
      expect(prefill?.text).toContain('Make it orange')
      expect(prefill?.attachments?.[0]?.data).toBe('data:image/png;base64,test')
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  extractWorkspaceOpenTargets,
  isLocalPreviewUrl,
  normalizeWorkspaceOpenTarget,
} from './workspaceOpenTarget'

describe('workspaceOpenTarget', () => {
  it('opens localhost URLs in the workspace browser', () => {
    expect(normalizeWorkspaceOpenTarget('http://localhost:3000/app.')).toEqual({
      kind: 'browser',
      value: 'http://localhost:3000/app',
    })
  })

  it('opens local html files in the workspace browser', () => {
    expect(normalizeWorkspaceOpenTarget('C:\\repo\\index.html')).toEqual({
      kind: 'browser',
      value: 'file:///C:/repo/index.html',
    })
  })

  it('opens markdown files inside the current workdir as workspace previews', () => {
    expect(normalizeWorkspaceOpenTarget('C:\\repo\\docs\\README.md', 'C:\\repo')).toEqual({
      kind: 'workspace-preview',
      value: 'C:\\repo\\docs\\README.md',
      previewPath: 'docs/README.md',
    })
  })

  it('sends markdown files outside the workdir to the external opener', () => {
    expect(normalizeWorkspaceOpenTarget('C:\\elsewhere\\README.md', 'C:\\repo')).toEqual({
      kind: 'external',
      value: 'file:///C:/elsewhere/README.md',
    })
  })

  it('blocks dangerous protocols', () => {
    expect(normalizeWorkspaceOpenTarget('javascript:alert(1)').kind).toBe('blocked')
    expect(normalizeWorkspaceOpenTarget('data:text/html,hello').kind).toBe('blocked')
  })

  it('extracts local URLs and local html/md files', () => {
    expect(extractWorkspaceOpenTargets(
      'Open http://127.0.0.1:5173, file:///C:/repo/index.html and C:\\repo\\README.md',
    )).toEqual([
      'http://127.0.0.1:5173',
      'file:///C:/repo/index.html',
      'C:\\repo\\README.md',
    ])
  })

  it('identifies local inspectable URLs', () => {
    expect(isLocalPreviewUrl('file:///C:/repo/index.html')).toBe(true)
    expect(isLocalPreviewUrl('http://localhost:3000')).toBe(true)
    expect(isLocalPreviewUrl('https://example.com')).toBe(false)
  })
})

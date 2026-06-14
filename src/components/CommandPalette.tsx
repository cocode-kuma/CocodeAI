import * as React from 'react'
import { useState, useMemo } from 'react'
import { useRegisterOverlay } from '../context/overlayContext.js'
import { Text } from '../ink.js'
import { FuzzyPicker } from './design-system/FuzzyPicker.js'

export type PaletteItem = {
  id: string
  label: string
  description?: string
  category: 'session' | 'command' | 'settings'
  action: () => void
}

type Props = {
  items: PaletteItem[]
  onDone: () => void
}

export function CommandPalette({ items, onDone }: Props): React.ReactNode {
  useRegisterOverlay('command-palette')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return items
    return items.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    )
  }, [items, query])

  return (
    <FuzzyPicker
      title="Command Palette"
      placeholder="Type to search commands…"
      items={filtered}
      getKey={item => item.id}
      visibleCount={12}
      direction="up"
      onQueryChange={setQuery}
      onSelect={item => {
        item.action()
        onDone()
      }}
      onCancel={onDone}
      emptyMessage={q => (q ? 'No commands found' : 'Type to search…')}
      renderItem={(item, isFocused) => (
        <Text color={isFocused ? 'suggestion' : undefined}>
          <Text dimColor>{item.category} </Text>
          {item.label}
          {item.description && <Text dimColor>  {item.description}</Text>}
        </Text>
      )}
    />
  )
}

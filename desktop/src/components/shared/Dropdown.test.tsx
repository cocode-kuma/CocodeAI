import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dropdown } from './Dropdown'

describe('Dropdown', () => {
  it('opens the menu and selects an item without HeroUI context primitives', () => {
    const onChange = vi.fn()

    render(
      <Dropdown
        items={[
          { value: 'auto', label: 'Auto' },
          { value: 'manual', label: 'Manual', description: 'Use custom settings' },
        ]}
        value="auto"
        onChange={onChange}
        trigger={<button type="button">Open menu</button>}
      />,
    )

    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('listbox')).not.toBeNull()
    expect(screen.getByRole('option', { name: /Auto/ }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('option', { name: /Manual/ }))

    expect(onChange).toHaveBeenCalledWith('manual')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ItemOptionsModal } from '../item-options-modal';
import type { MenuItem } from '../../../types';

describe('ItemOptionsModal', () => {
  it('translates known English options into Chinese and appends them to zhName', () => {
    const mockItem: MenuItem = {
      id: 'D01',
      name: {
        en: 'Crispy Duck',
        zh: '香酥鸭'
      },
      price: 15,
      options: [
        { name: 'Half', price: 15 },
        { name: 'Whole', price: 28 }
      ],
      contents: [
        {
          type: 'choice',
          description: 'Side',
          options: ['Chips', 'Fried Rice', 'Boiled Rice']
        }
      ]
    };

    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ItemOptionsModal 
        item={mockItem} 
        onConfirm={handleConfirm} 
        onClose={handleClose} 
      />
    );

    // Initial state will auto-select 'Half' and 'Chips' based on the useEffect
    // Let's click 'Whole' and 'Fried Rice'
    fireEvent.click(screen.getByText('Whole'));
    fireEvent.click(screen.getByText('Fried Rice'));

    // Click confirm
    fireEvent.click(screen.getByText('Confirm & Add'));

    expect(handleConfirm).toHaveBeenCalledWith({
      name: {
        en: 'Crispy Duck (Whole, Fried Rice)',
        zh: '香酥鸭 (全, 炒饭)'
      },
      price: 28 // Price is updated to 'Whole' price
    });
  });

  it('falls back to English if the translation is not in the dictionary', () => {
    const mockItem: MenuItem = {
      id: 'D02',
      name: {
        en: 'Special Drink',
        zh: '特饮'
      },
      options: [
        { name: 'Normal', price: 2.5 },
        { name: 'Extra Cold', price: 3.0 } // 'Extra Cold' is not in translations
      ]
    };

    const handleConfirm = vi.fn();

    render(
      <ItemOptionsModal 
        item={mockItem} 
        onConfirm={handleConfirm} 
        onClose={vi.fn()} 
      />
    );

    fireEvent.click(screen.getByText('Extra Cold'));
    fireEvent.click(screen.getByText('Confirm & Add'));

    expect(handleConfirm).toHaveBeenCalledWith({
      name: {
        en: 'Special Drink (Extra Cold)',
        zh: '特饮 (Extra Cold)' // No translation available, so it falls back!
      },
      price: 3.0
    });
  });
});

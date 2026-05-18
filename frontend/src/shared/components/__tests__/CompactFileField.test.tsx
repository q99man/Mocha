import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompactFileField } from '../CompactFileField';

describe('CompactFileField', () => {
  it('shows the configured picker button label', () => {
    render(<CompactFileField label="참조 영상" buttonLabel="영상 선택" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: /영상 선택/ })).toBeInTheDocument();
  });
});

// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourceDefaultIcon } from './SourceDefaultIcon';

describe('SourceDefaultIcon', () => {
  it('renders a source-specific accessible label', () => {
    const { rerender } = render(<SourceDefaultIcon source="live" />);

    expect(
      screen.getByRole('img', { name: 'Live brew default icon' }),
    ).toBeDefined();

    rerender(<SourceDefaultIcon source="history" />);

    expect(
      screen.getByRole('img', { name: 'Selected shot default icon' }),
    ).toBeDefined();
  });
});

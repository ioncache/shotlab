// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyPanel } from './EmptyPanel';

describe('EmptyPanel', () => {
  it('renders the provided text', () => {
    render(<EmptyPanel text="No data available" />);

    expect(screen.getByText('No data available')).toBeDefined();
  });
});

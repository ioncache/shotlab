// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Metric } from './Metric';

describe('Metric', () => {
  it('renders the label and value', () => {
    render(<Metric label="Dose" value="18 g" />);

    expect(screen.getByText('Dose')).toBeDefined();
    expect(screen.getByText('18 g')).toBeDefined();
  });
});

// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartSkeleton, HistorySkeleton, ShotSkeleton } from './SkeletonStates';

describe('SkeletonStates', () => {
  it('renders chart placeholders', () => {
    const { container } = render(<ChartSkeleton />);

    expect(
      container.querySelectorAll('.MuiSkeleton-root').length,
    ).toBeGreaterThan(0);
  });

  it('renders shot placeholders', () => {
    const { container } = render(<ShotSkeleton />);

    expect(
      container.querySelectorAll('.MuiSkeleton-root').length,
    ).toBeGreaterThan(0);
  });

  it('renders history placeholders', () => {
    const { container } = render(<HistorySkeleton />);

    expect(
      container.querySelectorAll('.MuiSkeleton-root').length,
    ).toBeGreaterThan(0);
  });
});

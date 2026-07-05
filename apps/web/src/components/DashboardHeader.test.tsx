// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DashboardHeader } from './DashboardHeader';

describe('DashboardHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the dashboard title and debug control', () => {
    render(
      <DashboardHeader debugControl={<button type="button">Debug</button>} />,
    );

    expect(screen.getByText('ShotLab')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Debug' })).toBeDefined();
  });
});

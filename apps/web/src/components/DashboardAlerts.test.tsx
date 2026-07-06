// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DashboardAlerts } from './DashboardAlerts';

describe('DashboardAlerts', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the config warning and load errors', () => {
    render(
      <DashboardAlerts
        loadErrors={['Machine: Failed to load machine data.']}
        meticulousBaseUrlError="invalid"
      />,
    );

    expect(screen.getByText(/Live machine data is unavailable/)).toBeDefined();
    expect(
      screen.getByText('Machine: Failed to load machine data.'),
    ).toBeDefined();
  });

  it('renders duplicate load errors without collapsing them', () => {
    render(
      <DashboardAlerts
        loadErrors={[
          'Machine: Failed to load machine data.',
          'Machine: Failed to load machine data.',
        ]}
      />,
    );

    expect(
      screen.getAllByText('Machine: Failed to load machine data.'),
    ).toHaveLength(2);
  });
});

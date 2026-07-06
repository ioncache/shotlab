// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileDefaultIcon } from './ProfileDefaultIcon';

describe('ProfileDefaultIcon', () => {
  it('renders an accessible default profile icon label', () => {
    render(<ProfileDefaultIcon active label="Night Espresso" />);

    expect(
      screen.getByRole('img', { name: 'Night Espresso default profile icon' }),
    ).toBeDefined();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createDashboardClient } from './create-dashboard-client';

describe('createDashboardClient', () => {
  it('disables cached browser reads so the machine does not answer with 304', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ firmware: '0.2.24-369-gd28e82a' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    const client = createDashboardClient('http://machine.local:8080', fetchImpl);

    await client.getMachine();

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/machine',
      { cache: 'no-store', method: 'GET' },
    );
  });
});

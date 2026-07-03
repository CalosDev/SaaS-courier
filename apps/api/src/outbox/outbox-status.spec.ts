import { formatOutboxStatus } from './outbox-status';

describe('formatOutboxStatus', () => {
  it('prints only aggregate delivery state without event content', () => {
    const output = formatOutboxStatus({
      counts: {
        PENDING: 3,
        PROCESSING: 1,
        PUBLISHED: 2,
        FAILED: 0,
        DEAD_LETTER: 1,
      },
      oldestPendingAgeSeconds: 90,
      available: 2,
      locked: 1,
    });

    expect(output).toContain('PENDING: 3');
    expect(output).toContain('Oldest pending age: 00:01:30');
    expect(output).toContain('Available: 2');
    expect(output).toContain('Locked: 1');
    expect(output).not.toMatch(/payload|metadata|idempotency|aggregateId/i);
  });
});

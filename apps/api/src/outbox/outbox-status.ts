const OUTBOX_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PUBLISHED',
  'FAILED',
  'DEAD_LETTER',
] as const;

type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export interface OutboxStatusSnapshot {
  counts: Record<OutboxStatus, number>;
  oldestPendingAgeSeconds: number | null;
  available: number;
  locked: number;
}

export function formatOutboxStatus(snapshot: OutboxStatusSnapshot): string {
  return [
    ...OUTBOX_STATUSES.map((status) => `${status}: ${snapshot.counts[status]}`),
    `Oldest pending age: ${formatDuration(snapshot.oldestPendingAgeSeconds)}`,
    `Available: ${snapshot.available}`,
    `Locked: ${snapshot.locked}`,
  ].join('\n');
}

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) {
    return 'none';
  }

  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

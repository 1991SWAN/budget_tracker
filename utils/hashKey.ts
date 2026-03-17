export type HashDirection = 'IN' | 'OUT';

type HashDirectionInput = {
  type?: string | null;
  toAssetId?: string | null;
};

export function resolveHashDirection(input: HashDirectionInput): HashDirection {
  if (input.type === 'INCOME') return 'IN';
  if (input.type === 'EXPENSE') return 'OUT';
  if (input.type === 'TRANSFER') {
    return input.toAssetId ? 'OUT' : 'IN';
  }
  return 'OUT';
}

export function normalizeHashMemo(memo: string): string {
  return String(memo || '').trim().replace(/\s/g, '');
}

export function getTimeKey(timestamp: number): number {
  return Math.floor(timestamp / 60000);
}

export function generateTransactionHashBase(
  assetId: string,
  timestamp: number,
  amount: number,
  memo: string,
  direction: HashDirection
): string {
  const timeKey = getTimeKey(timestamp);
  const normalizedMemo = normalizeHashMemo(memo);
  const raw = `${assetId}|${timeKey}|${amount}|${direction}|${normalizedMemo}`;

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  return hash.toString(16);
}

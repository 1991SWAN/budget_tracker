import {
  ImportReconciliationCandidate,
  ImportReconciliationCandidateScore,
  Transaction,
  TransactionType
} from '../types';
import { getTimeKey } from './hashKey';

export type ScoredImportReconciliationCandidate = ImportReconciliationCandidate & {
  score: ImportReconciliationCandidateScore;
};

export const normalizeReviewMemo = (memo: string): string => {
  return String(memo || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\(주\)|주식회사|\bcorp\b|\binc\b/gi, '')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
};

export const getNeedsReviewMemoKey = (memo: string, type?: TransactionType): string => {
  const normalized = normalizeReviewMemo(memo);
  if (!normalized) return '';

  // Numeric identifiers can lose leading zeros when exported through numeric cells.
  // Apply the lenient comparison to income/expense review matching only.
  if (
    (type === TransactionType.INCOME || type === TransactionType.EXPENSE) &&
    /^\d+$/.test(normalized)
  ) {
    const stripped = normalized.replace(/^0+/, '');
    return stripped || '0';
  }

  return normalized;
};

export const getNeedsReviewLabel = (type?: TransactionType): string => {
  if (type === TransactionType.EXPENSE) return '지출';
  if (type === TransactionType.INCOME) return '수입';
  return '거래';
};

export const buildNeedsReviewCandidates = (
  transaction: Partial<Transaction>,
  reconciliationCandidates: ImportReconciliationCandidate[] = []
): ScoredImportReconciliationCandidate[] => {
  if (
    (transaction.type !== TransactionType.INCOME && transaction.type !== TransactionType.EXPENSE) ||
    !transaction.assetId ||
    !transaction.timestamp ||
    !transaction.amount
  ) {
    return [];
  }

  const transactionMemoSource = transaction.memo || transaction.merchant || '';
  const reviewMemo = getNeedsReviewMemoKey(transactionMemoSource, transaction.type);
  if (!reviewMemo) return [];

  const reviewWindowMs = 30 * 24 * 60 * 60 * 1000;
  const rawMemo = String(transactionMemoSource).trim();
  const transactionTimestamp = Number(transaction.timestamp);
  const transactionTimeKey = getTimeKey(transactionTimestamp);
  const transactionType = transaction.type;

  return reconciliationCandidates
    .filter(candidate => {
      const candidateTimestamp = Number(candidate.timestamp);
      if (!candidate?.id || !candidateTimestamp) return false;

      const candidateMemo = getNeedsReviewMemoKey(
        String(candidate.memo || candidate.merchant || ''),
        candidate.type
      );
      if (candidateMemo !== reviewMemo) return false;

      if (
        candidate.assetId !== transaction.assetId ||
        candidate.type !== transactionType ||
        Number(candidate.amount) !== Number(transaction.amount)
      ) {
        return false;
      }

      if (transactionType === TransactionType.EXPENSE) {
        return getTimeKey(candidateTimestamp) === transactionTimeKey;
      }

      return (
        candidateTimestamp <= transactionTimestamp &&
        (transactionTimestamp - candidateTimestamp) <= reviewWindowMs
      );
    })
    .map(candidate => ({
      ...candidate,
      timestamp: Number(candidate.timestamp),
      score: {
        rawMemoExact: String(candidate.memo || candidate.merchant || '').trim() === rawMemo ? 1 : 0,
        timeKeyExact: getTimeKey(Number(candidate.timestamp)) === transactionTimeKey ? 1 : 0,
        delta: Math.abs(transactionTimestamp - Number(candidate.timestamp)),
      }
    }))
    .sort((left, right) => {
      if (right.score.rawMemoExact !== left.score.rawMemoExact) {
        return right.score.rawMemoExact - left.score.rawMemoExact;
      }

      if (right.score.timeKeyExact !== left.score.timeKeyExact) {
        return right.score.timeKeyExact - left.score.timeKeyExact;
      }

      if (left.score.delta !== right.score.delta) {
        return left.score.delta - right.score.delta;
      }

      return String(left.id).localeCompare(String(right.id));
    });
};

export const selectNeedsReviewTarget = (
  candidates: ScoredImportReconciliationCandidate[]
): string | undefined => {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0].id;

  const [best, second] = candidates;
  if (!second) return best.id;

  const bestScore = best.score || { rawMemoExact: 0, timeKeyExact: 0, delta: Number.MAX_SAFE_INTEGER };
  const secondScore = second.score || { rawMemoExact: 0, timeKeyExact: 0, delta: Number.MAX_SAFE_INTEGER };

  if (
    bestScore.rawMemoExact !== secondScore.rawMemoExact ||
    bestScore.timeKeyExact !== secondScore.timeKeyExact ||
    bestScore.delta !== secondScore.delta
  ) {
    return best.id;
  }

  return undefined;
};

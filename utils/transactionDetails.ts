import { Tag } from '../types';

export interface ParsedTransactionDetails {
  memo: string;
  merchant: string | null;
  tags: string[];
}

const TAG_REGEX = /#(?:"([^"]+)"|'([^']+)'|(\S+))/g;
const QUOTED_MERCHANT_REGEX = /(^|\s)@(?:"([^"]+)"|'([^']+)')(?=\s|$)/;
const TRAILING_MERCHANT_REGEX = /(^|\s)@(.+)$/;

const normalizeWhitespace = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim();

const uniqueValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values.filter(value => {
    const normalized = normalizeWhitespace(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const formatQuotedToken = (prefix: '@' | '#', value: string): string => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';

  if (prefix === '@') {
    if (!/[@#]/.test(normalized)) return `${prefix}${normalized}`;
  } else if (!/[\s@#]/.test(normalized)) {
    return `${prefix}${normalized}`;
  }

  if (!normalized.includes('"')) return `${prefix}"${normalized}"`;
  if (!normalized.includes("'")) return `${prefix}'${normalized}'`;
  return `${prefix}${normalized.replace(/\s+/g, '_')}`;
};

export const getTransactionTagNames = (
  tags?: Array<string | Pick<Tag, 'name'>> | null
): string[] => {
  if (!tags || tags.length === 0) return [];

  return uniqueValues(
    tags
      .map(tag => typeof tag === 'string' ? tag : tag?.name)
      .map(value => normalizeWhitespace(String(value || '')).replace(/^#/, ''))
      .filter(Boolean)
  );
};

export const parseTransactionDetailsInput = (input: string): ParsedTransactionDetails => {
  let working = String(input || '');
  const tags: string[] = [];

  working = working.replace(TAG_REGEX, (_match, doubleQuoted, singleQuoted, bare) => {
    const value = normalizeWhitespace(doubleQuoted || singleQuoted || bare || '').replace(/^#/, '');
    if (value) tags.push(value);
    return ' ';
  });

  let merchant: string | null = null;

  working = working.replace(QUOTED_MERCHANT_REGEX, (match, leadingSpace, doubleQuoted, singleQuoted) => {
    merchant = normalizeWhitespace(doubleQuoted || singleQuoted || '');
    return leadingSpace ? ' ' : '';
  });

  if (!merchant) {
    working = working.replace(TRAILING_MERCHANT_REGEX, (match, leadingSpace, rawMerchant) => {
      merchant = normalizeWhitespace(rawMerchant || '');
      return leadingSpace ? ' ' : '';
    });
  }

  return {
    memo: normalizeWhitespace(working),
    merchant: merchant || null,
    tags: uniqueValues(tags),
  };
};

export const formatTransactionDetailsInput = ({
  memo,
  merchant,
  tags,
}: {
  memo?: string | null;
  merchant?: string | null;
  tags?: Array<string | Pick<Tag, 'name'>> | null;
}): string => {
  const parts: string[] = [];
  const normalizedMemo = normalizeWhitespace(String(memo || ''));
  const normalizedMerchant = normalizeWhitespace(String(merchant || ''));
  const tagNames = getTransactionTagNames(tags);

  if (normalizedMemo) parts.push(normalizedMemo);
  if (normalizedMerchant) parts.push(formatQuotedToken('@', normalizedMerchant));
  if (tagNames.length > 0) parts.push(...tagNames.map(tag => formatQuotedToken('#', tag)));

  return parts.join(' ').trim();
};

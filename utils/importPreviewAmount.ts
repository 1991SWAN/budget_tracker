import { TransactionType } from '../types';

const parseImportPreviewAmount = (value: unknown): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const raw = String(value ?? '').trim();
    if (!raw) return null;

    const parsed = Number.parseFloat(raw.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
};

export const formatImportPreviewAmountDisplay = (value: unknown): string => {
    const parsed = parseImportPreviewAmount(value);
    if (parsed === null) return '—';

    return String(Math.abs(parsed));
};

interface NormalizeImportPreviewEditedAmountOptions {
    value: unknown;
    currentType?: TransactionType;
    usesSignedAmountColumn: boolean;
    hasExplicitTypeValue: boolean;
}

export const normalizeImportPreviewEditedAmount = ({
    value,
    currentType,
    usesSignedAmountColumn,
    hasExplicitTypeValue
}: NormalizeImportPreviewEditedAmountOptions): unknown => {
    const parsed = parseImportPreviewAmount(value);
    if (parsed === null) return value;

    const magnitude = Math.abs(parsed);
    if (!usesSignedAmountColumn || hasExplicitTypeValue) {
        return String(magnitude);
    }

    const raw = String(value ?? '').trim();
    if (raw.startsWith('-')) {
        return String(-magnitude);
    }

    if (raw.startsWith('+')) {
        return String(magnitude);
    }

    if (currentType === TransactionType.EXPENSE) {
        return String(-magnitude);
    }

    return String(magnitude);
};

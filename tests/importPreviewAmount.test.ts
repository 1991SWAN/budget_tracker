import { describe, expect, it } from 'vitest';
import { TransactionType } from '../types';
import {
    formatImportPreviewAmountDisplay,
    normalizeImportPreviewEditedAmount,
} from '../utils/importPreviewAmount';

describe('import preview amount helpers', () => {
    it('renders signed source amounts as unsigned preview values', () => {
        expect(formatImportPreviewAmountDisplay('-1494')).toBe('1494');
        expect(formatImportPreviewAmountDisplay(1494)).toBe('1494');
    });

    it('preserves the current expense type when the signed amount column is edited without a sign', () => {
        expect(normalizeImportPreviewEditedAmount({
            value: '2000',
            currentType: TransactionType.EXPENSE,
            usesSignedAmountColumn: true,
            hasExplicitTypeValue: false,
        })).toBe('-2000');
    });

    it('lets an explicit negative sign switch the inferred type to expense', () => {
        expect(normalizeImportPreviewEditedAmount({
            value: '-2000',
            currentType: TransactionType.INCOME,
            usesSignedAmountColumn: true,
            hasExplicitTypeValue: false,
        })).toBe('-2000');
    });

    it('keeps explicit-type rows unsigned because the type column is authoritative', () => {
        expect(normalizeImportPreviewEditedAmount({
            value: '2000',
            currentType: TransactionType.EXPENSE,
            usesSignedAmountColumn: true,
            hasExplicitTypeValue: true,
        })).toBe('2000');
    });
});

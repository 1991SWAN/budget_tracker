import { describe, expect, it } from 'vitest';
import { Category, CategoryItem } from '../types';
import { getDefaultCategoryId, normalizeCategoryId } from '../utils/category';

const categories: CategoryItem[] = [
    { id: 'expense-housing', user_id: 'user-1', name: 'Housing & Bill', emoji: '🏠', type: 'EXPENSE', is_default: true, sort_order: 0 },
    { id: 'expense-other', user_id: 'user-1', name: 'Other', emoji: '♾️', type: 'EXPENSE', is_default: true, sort_order: 1 },
    { id: 'income-salary', user_id: 'user-1', name: 'Salary', emoji: '💰', type: 'INCOME', is_default: true, sort_order: 2 },
    { id: 'transfer-card', user_id: 'user-1', name: 'Card Payment', emoji: '💳', type: 'TRANSFER', is_default: true, sort_order: 3 },
];

describe('category normalization', () => {
    it('keeps an existing category id unchanged', () => {
        expect(normalizeCategoryId('expense-other', categories, { type: 'EXPENSE' })).toBe('expense-other');
    });

    it('maps legacy enum values to the preferred default category id', () => {
        expect(normalizeCategoryId(Category.UTILITIES, categories, { type: 'EXPENSE' })).toBe('expense-housing');
        expect(normalizeCategoryId(Category.TRANSFER, categories, { type: 'TRANSFER' })).toBe('transfer-card');
    });

    it('falls back to the preferred default category for the type', () => {
        expect(getDefaultCategoryId(categories, 'EXPENSE', ['Other'])).toBe('expense-other');
        expect(getDefaultCategoryId(categories, 'INCOME', ['Salary'])).toBe('income-salary');
    });
});

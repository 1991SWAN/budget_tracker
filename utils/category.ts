import { Category, CategoryId, CategoryItem } from '../types';

const LEGACY_CATEGORY_TYPE: Partial<Record<Category, CategoryItem['type']>> = {
    [Category.FOOD]: 'EXPENSE',
    [Category.TRANSPORT]: 'EXPENSE',
    [Category.SHOPPING]: 'EXPENSE',
    [Category.HOUSING]: 'EXPENSE',
    [Category.UTILITIES]: 'EXPENSE',
    [Category.HEALTH]: 'EXPENSE',
    [Category.ENTERTAINMENT]: 'EXPENSE',
    [Category.SALARY]: 'INCOME',
    [Category.INVESTMENT]: 'INCOME',
    [Category.TRANSFER]: 'TRANSFER',
    [Category.OTHER]: 'EXPENSE',
};

const LEGACY_CATEGORY_PREFERENCES: Partial<Record<Category, string[]>> = {
    [Category.FOOD]: ['Food & Dining', 'Other'],
    [Category.TRANSPORT]: ['Transportation', 'Other'],
    [Category.SHOPPING]: ['Shopping', 'Other'],
    [Category.HOUSING]: ['Housing & Bill', 'Other'],
    [Category.UTILITIES]: ['Housing & Bill', 'Finance', 'Other'],
    [Category.HEALTH]: ['Health', 'Other'],
    [Category.ENTERTAINMENT]: ['Entertainment', 'Other'],
    [Category.SALARY]: ['Salary'],
    [Category.INVESTMENT]: ['Investment', 'Savings/Invest'],
    [Category.TRANSFER]: ['Card Payment', 'Savings/Invest', 'Withdrawal'],
    [Category.OTHER]: ['Other'],
};

const normalizeName = (value: string) => value.trim().toLowerCase();

const findCategoryByName = (categories: CategoryItem[], name: string) => {
    const normalized = normalizeName(name);
    return categories.find(category => normalizeName(category.name) === normalized);
};

export const getDefaultCategoryId = (
    categories: CategoryItem[],
    type: CategoryItem['type'],
    preferredNames: string[] = []
): CategoryId => {
    for (const preferredName of preferredNames) {
        const match = categories.find(category =>
            category.type === type && normalizeName(category.name) === normalizeName(preferredName)
        );
        if (match) return match.id;
    }

    const typeMatch = categories.find(category => category.type === type);
    if (typeMatch) return typeMatch.id;

    return categories[0]?.id || '';
};

export const normalizeCategoryId = (
    value: string | undefined | null,
    categories: CategoryItem[],
    options?: {
        type?: CategoryItem['type'];
        preferredNames?: string[];
        fallbackValue?: string;
    }
): CategoryId => {
    if (!value) {
        return options?.type
            ? getDefaultCategoryId(categories, options.type, options.preferredNames)
            : options?.fallbackValue || '';
    }

    const byId = categories.find(category => category.id === value);
    if (byId) return byId.id;

    const byName = findCategoryByName(categories, value);
    if (byName) return byName.id;

    const legacyKey = value as Category;
    if (legacyKey in LEGACY_CATEGORY_PREFERENCES) {
        const inferredType = options?.type || LEGACY_CATEGORY_TYPE[legacyKey];
        const preferredNames = options?.preferredNames || LEGACY_CATEGORY_PREFERENCES[legacyKey] || [];

        if (inferredType) {
            const normalized = getDefaultCategoryId(categories, inferredType, preferredNames);
            if (normalized) return normalized;
        }
    }

    if (options?.type) {
        const fallback = getDefaultCategoryId(categories, options.type, options.preferredNames);
        if (fallback) return fallback;
    }

    return options?.fallbackValue || value;
};

export const getCategoryLabel = (value: string | undefined | null, categories: CategoryItem[]) => {
    if (!value) return '';

    const category = categories.find(item => item.id === value) || findCategoryByName(categories, value);
    return category?.name || value;
};

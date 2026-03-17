import type { SetStateAction } from 'react';
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanningController } from '../hooks/usePlanningController';
import { BillType, CategoryItem, RecurringTransaction, SavingsGoal, TransactionType } from '../types';

const mocks = vi.hoisted(() => ({
    saveProfile: vi.fn(),
    saveRecurring: vi.fn(),
    deleteRecurring: vi.fn(),
    saveGoal: vi.fn(),
    deleteGoal: vi.fn(),
    addTransaction: vi.fn(),
    setGoals: vi.fn(),
    setRecurring: vi.fn(),
    setMonthlyBudget: vi.fn(),
    setModalType: vi.fn(),
    setSelectedItem: vi.fn(),
    setFormData: vi.fn(),
    normalizeTransactionCategory: vi.fn(),
}));

vi.mock('../services/profileService', () => ({
    ProfileService: {
        saveProfile: mocks.saveProfile,
    },
}));

vi.mock('../services/recurringService', () => ({
    RecurringService: {
        saveRecurring: mocks.saveRecurring,
        deleteRecurring: mocks.deleteRecurring,
    },
}));

vi.mock('../services/goalService', () => ({
    GoalService: {
        saveGoal: mocks.saveGoal,
        deleteGoal: mocks.deleteGoal,
    },
}));

const categories: CategoryItem[] = [
    { id: 'expense-housing', user_id: 'user-1', name: 'Housing & Bill', emoji: '🏠', type: 'EXPENSE', is_default: true, sort_order: 0 },
    { id: 'expense-other', user_id: 'user-1', name: 'Other', emoji: '♾️', type: 'EXPENSE', is_default: true, sort_order: 1 },
    { id: 'transfer-savings', user_id: 'user-1', name: 'Savings/Invest', emoji: '🏦', type: 'TRANSFER', is_default: true, sort_order: 2 },
];

const baseGoal: SavingsGoal = {
    id: 'goal-1',
    name: 'Trip',
    targetAmount: 500000,
    currentAmount: 100000,
    emoji: '✈️',
};

const applyUpdater = <T,>(updater: SetStateAction<T>, current: T): T => (
    typeof updater === 'function'
        ? (updater as (value: T) => T)(current)
        : updater
);

const renderPlanningController = (overrides: Partial<Parameters<typeof usePlanningController>[0]> = {}) => (
    renderHook(() => usePlanningController({
        categories,
        goals: [baseGoal],
        setGoals: mocks.setGoals,
        setRecurring: mocks.setRecurring,
        setMonthlyBudget: mocks.setMonthlyBudget,
        addTransaction: mocks.addTransaction,
        defaultExpenseCategoryId: 'expense-other',
        goalTransferCategoryId: 'transfer-savings',
        normalizeTransactionCategory: mocks.normalizeTransactionCategory,
        setModalType: mocks.setModalType,
        setSelectedItem: mocks.setSelectedItem,
        setFormData: mocks.setFormData,
        ...overrides,
    }))
);

describe('usePlanningController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-17T09:00:00+09:00'));
        mocks.addTransaction.mockResolvedValue(undefined);
        mocks.normalizeTransactionCategory.mockReturnValue('expense-normalized');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('saves the monthly budget and updates local state', async () => {
        const { result } = renderPlanningController();

        await act(async () => {
            await result.current.handleBudgetChange(4200000);
        });

        expect(mocks.setMonthlyBudget).toHaveBeenCalledWith(4200000);
        expect(mocks.saveProfile).toHaveBeenCalledWith({ monthly_budget: 4200000 });
    });

    it('adds recurring bills with normalized category ids and appends them locally', () => {
        const { result } = renderPlanningController();

        act(() => {
            result.current.handleRecurringChange('add', {
                name: 'Rent',
                amount: 1200000,
                dayOfMonth: 25,
                category: 'Housing & Bill',
                billType: BillType.SUBSCRIPTION,
            });
        });

        expect(mocks.saveRecurring).toHaveBeenCalledWith(expect.objectContaining({
            id: String(Date.now()),
            name: 'Rent',
            category: 'expense-housing',
        }));

        const updater = mocks.setRecurring.mock.calls[0][0];
        const nextState = applyUpdater(updater, [] as RecurringTransaction[]);
        expect(nextState).toEqual([
            expect.objectContaining({
                id: String(Date.now()),
                name: 'Rent',
                amount: 1200000,
                category: 'expense-housing',
            }),
        ]);
    });

    it('creates an expense transaction when paying a recurring bill', () => {
        const { result } = renderPlanningController();

        act(() => {
            result.current.handleRecurringChange('pay', {
                name: 'Netflix',
                amount: 17000,
                category: 'expense-other',
                assetId: 'asset-bank',
            });
        });

        expect(mocks.normalizeTransactionCategory).toHaveBeenCalledWith(TransactionType.EXPENSE, 'expense-other');
        expect(mocks.addTransaction).toHaveBeenCalledWith(expect.objectContaining({
            id: `bp-${Date.now()}`,
            date: '2026-03-17',
            amount: 17000,
            type: TransactionType.EXPENSE,
            category: 'expense-normalized',
            memo: 'Bill Pay: Netflix',
            assetId: 'asset-bank',
        }));
    });

    it('updates goal progress and creates a transfer transaction for contributions', () => {
        const { result } = renderPlanningController();

        act(() => {
            result.current.handleGoalChange('contribute', {
                id: 'goal-1',
                name: 'Trip',
                amount: 50000,
                assetId: 'asset-bank',
                toAssetId: 'asset-savings',
            });
        });

        expect(mocks.saveGoal).toHaveBeenCalledWith(expect.objectContaining({
            id: 'goal-1',
            currentAmount: 150000,
        }));

        const updater = mocks.setGoals.mock.calls[0][0];
        const nextGoals = applyUpdater(updater, [baseGoal]);
        expect(nextGoals).toEqual([
            expect.objectContaining({
                id: 'goal-1',
                currentAmount: 150000,
            }),
        ]);

        expect(mocks.addTransaction).toHaveBeenCalledWith(expect.objectContaining({
            id: `gc-${Date.now()}`,
            date: '2026-03-17',
            amount: 50000,
            type: TransactionType.TRANSFER,
            category: 'transfer-savings',
            memo: 'Goal: Trip',
            assetId: 'asset-bank',
            toAssetId: 'asset-savings',
        }));
    });

    it('opens the bill modal with group-specific defaults', () => {
        const { result } = renderPlanningController();

        act(() => {
            result.current.openAddBillToGroup('Utilities');
        });

        expect(mocks.setModalType).toHaveBeenCalledWith('bill');
        expect(mocks.setSelectedItem).toHaveBeenCalledWith(null);
        expect(mocks.setFormData).toHaveBeenCalledWith({
            name: '',
            amount: '',
            dayOfMonth: 1,
            category: 'expense-housing',
            billType: BillType.SUBSCRIPTION,
            groupName: 'Utilities',
        });
    });
});

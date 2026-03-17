import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionType } from '../types';
import { useAppController } from '../hooks/useAppController';

const mockState = vi.hoisted(() => {
    const baseTransactions = [
        {
            id: 'tx-1',
            date: '2026-03-13',
            amount: 15000,
            type: 'EXPENSE',
            category: 'expense-other',
            memo: 'Lunch',
            assetId: 'asset-bank',
        },
        {
            id: 'tx-2',
            date: '2026-03-12',
            amount: 22000,
            type: 'EXPENSE',
            category: 'expense-other',
            memo: 'Dinner',
            assetId: 'asset-bank',
        },
    ];

    return {
        addToast: vi.fn(),
        refreshData: vi.fn(),
        setAssets: vi.fn(),
        setTransactions: vi.fn(),
        setRecurring: vi.fn(),
        setGoals: vi.fn(),
        setMonthlyBudget: vi.fn(),
        fetchMoreTransactions: vi.fn(),
        addTransaction: vi.fn(),
        addTransactions: vi.fn(),
        updateTransaction: vi.fn(),
        updateTransactions: vi.fn(),
        deleteTransaction: vi.fn(),
        deleteTransactions: vi.fn(),
        processImportedTransactions: vi.fn(),
        baseAssets: [
            {
                id: 'asset-bank',
                name: 'Main Bank',
                type: 'CHECKING',
                balance: 500000,
                initialBalance: 500000,
                currency: 'KRW',
            },
            {
                id: 'asset-card',
                name: 'Main Card',
                type: 'CREDIT_CARD',
                balance: -120000,
                initialBalance: 0,
                currency: 'KRW',
            },
        ],
        baseTransactions,
        baseCategories: [
            { id: 'expense-other', user_id: 'user-1', name: 'Other', emoji: '♾️', type: 'EXPENSE', is_default: true, sort_order: 0 },
            { id: 'transfer-card', user_id: 'user-1', name: 'Card Payment', emoji: '💳', type: 'TRANSFER', is_default: true, sort_order: 1 },
            { id: 'income-salary', user_id: 'user-1', name: 'Salary', emoji: '💰', type: 'INCOME', is_default: true, sort_order: 2 },
        ],
        baseGoals: [
            { id: 'goal-1', name: 'Emergency Fund', targetAmount: 1000000, currentAmount: 250000, emoji: '🎯' },
        ],
    };
});

vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({ addToast: mockState.addToast }),
}));

vi.mock('../hooks/useAppData', () => ({
    useAppData: () => ({
        assets: mockState.baseAssets,
        setAssets: mockState.setAssets,
        transactions: mockState.baseTransactions,
        setTransactions: mockState.setTransactions,
        recurring: [],
        setRecurring: mockState.setRecurring,
        goals: mockState.baseGoals,
        setGoals: mockState.setGoals,
        monthlyBudget: 3000000,
        setMonthlyBudget: mockState.setMonthlyBudget,
        hasMoreTransactions: false,
        fetchMoreTransactions: mockState.fetchMoreTransactions,
        isFetchingMore: false,
        refreshData: mockState.refreshData,
    }),
}));

vi.mock('../hooks/useCategoryManager', () => ({
    useCategoryManager: () => ({
        categories: mockState.baseCategories,
    }),
}));

vi.mock('../hooks/useTransactionManager', () => ({
    useTransactionManager: () => ({
        addTransaction: mockState.addTransaction,
        addTransactions: mockState.addTransactions,
        updateTransaction: mockState.updateTransaction,
        updateTransactions: mockState.updateTransactions,
        deleteTransaction: mockState.deleteTransaction,
        deleteTransactions: mockState.deleteTransactions,
    }),
}));

vi.mock('../hooks/useTransferReconciler', () => ({
    useTransferReconciler: () => ({
        candidates: [],
        singleCandidates: [],
        handleLink: vi.fn(),
        handleConvert: vi.fn(),
        handleIgnore: vi.fn(),
    }),
}));

vi.mock('../hooks/useRegularExpenseDetector', () => ({
    useGlobalRegularExpenseDetector: () => ({
        candidates: [],
        candidateTxIds: new Set(),
    }),
}));

vi.mock('../hooks/useModalClose', () => ({
    useModalClose: vi.fn(),
}));

vi.mock('../services/importService', () => ({
    ImportService: {
        processImportedTransactions: mockState.processImportedTransactions,
    },
}));

vi.mock('../services/assetService', () => ({
    AssetService: {
        getAssets: vi.fn(),
        saveAsset: vi.fn(),
        saveOpeningBalance: vi.fn(),
        deleteAsset: vi.fn(),
    },
}));

vi.mock('../services/profileService', () => ({
    ProfileService: {
        saveProfile: vi.fn(),
    },
}));

vi.mock('../services/recurringService', () => ({
    RecurringService: {
        saveRecurring: vi.fn(),
        deleteRecurring: vi.fn(),
    },
}));

vi.mock('../services/goalService', () => ({
    GoalService: {
        saveGoal: vi.fn(),
        deleteGoal: vi.fn(),
    },
}));

vi.mock('../services/transactionService', () => ({
    TransactionService: {
        deleteTransactionsByAsset: vi.fn(),
    },
}));

describe('useAppController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockState.processImportedTransactions.mockReturnValue({
            finalNewTxs: [],
            updatedExistingTxs: [],
        });
        mockState.addTransactions.mockResolvedValue(undefined);
        mockState.updateTransactions.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('changes views, opens Penny chat for analysis, and responds to popstate', () => {
        const { result } = renderHook(() => useAppController({ id: 'user-1' }));

        act(() => {
            result.current.shell.onNavigate('transactions');
        });
        expect(result.current.shell.view).toBe('transactions');

        act(() => {
            result.current.shell.onNavigate('analysis');
        });
        expect(result.current.shell.view).toBe('transactions');
        expect(result.current.overlays.pennyChat.isOpen).toBe(true);

        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate', { state: { view: 'assets' } }));
        });
        expect(result.current.shell.view).toBe('assets');
    });

    it('opens smart input for quick add and existing transaction edit intents', () => {
        const { result } = renderHook(() => useAppController({ id: 'user-1' }));

        act(() => {
            result.current.actions.openQuickAdd();
        });
        expect(result.current.overlays.smartInput.isOpen).toBe(true);
        expect(result.current.overlays.smartInput.initialData).toBeNull();

        act(() => {
            result.current.actions.openEditTransaction('tx-1');
        });
        expect(result.current.overlays.smartInput.isOpen).toBe(true);
        expect(result.current.overlays.smartInput.initialData?.id).toBe('tx-1');
    });

    it('routes add-asset requests through explicit assets screen state instead of a window event', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const { result } = renderHook(() => useAppController({ id: 'user-1' }));

        expect(result.current.screens.assets.createRequestKey).toBe(0);

        act(() => {
            result.current.shell.onNavigate('transactions');
            result.current.shell.onAddAsset();
        });

        expect(result.current.shell.view).toBe('assets');
        expect(result.current.screens.assets.createRequestKey).toBe(1);
        expect(dispatchSpy).not.toHaveBeenCalled();

        act(() => {
            result.current.shell.onAddAsset();
        });

        expect(result.current.screens.assets.createRequestKey).toBe(2);
    });

    it('dispatches import confirmation through the transaction action hooks', async () => {
        const { result } = renderHook(() => useAppController({ id: 'user-1' }));

        const normalImport = {
            id: 'import-1',
            date: '2026-03-13',
            amount: 17000,
            type: TransactionType.EXPENSE,
            category: 'expense-other',
            memo: 'Imported',
            assetId: 'asset-bank',
        };
        const replaceImport = {
            id: 'temp-replace',
            replaceTargetId: 'tx-2',
            date: '2026-03-13',
            amount: 21000,
            type: TransactionType.EXPENSE,
            category: 'expense-other',
            memo: 'Replacement',
            assetId: 'asset-bank',
        };

        mockState.processImportedTransactions.mockReturnValue({
            finalNewTxs: [normalImport],
            updatedExistingTxs: [
                {
                    ...mockState.baseTransactions[0],
                    memo: 'Updated transfer match',
                },
            ],
        });

        await act(async () => {
            await result.current.overlays.importWizard.onConfirm([
                normalImport as any,
                replaceImport as any,
            ]);
        });

        expect(mockState.processImportedTransactions).toHaveBeenCalledWith(
            [normalImport],
            mockState.baseTransactions
        );
        expect(mockState.addTransactions).toHaveBeenCalledWith([normalImport]);
        expect(mockState.updateTransactions).toHaveBeenCalledWith([
            {
                ...mockState.baseTransactions[0],
                memo: 'Updated transfer match',
            },
        ]);
        expect(mockState.updateTransactions).toHaveBeenCalledWith([
            {
                id: 'tx-2',
                date: '2026-03-13',
                amount: 21000,
                type: TransactionType.EXPENSE,
                category: 'expense-other',
                memo: 'Replacement',
                assetId: 'asset-bank',
                tags: undefined,
                isReconciliationIgnored: undefined,
            },
        ]);
    });
});

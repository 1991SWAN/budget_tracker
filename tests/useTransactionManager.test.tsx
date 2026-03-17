import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category, Transaction, TransactionType } from '../types';
import { useTransactionManager } from '../hooks/useTransactionManager';

const mocks = vi.hoisted(() => ({
    addToast: vi.fn(),
    saveTransaction: vi.fn(),
    saveTransactions: vi.fn(),
    deleteTransaction: vi.fn(),
    deleteTransactions: vi.fn(),
}));

vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../services/supabaseService', () => ({
    SupabaseService: {
        saveTransaction: mocks.saveTransaction,
        saveTransactions: mocks.saveTransactions,
        deleteTransaction: mocks.deleteTransaction,
        deleteTransactions: mocks.deleteTransactions,
    },
}));

describe('useTransactionManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.saveTransactions.mockResolvedValue(undefined);
        mocks.deleteTransaction.mockResolvedValue(undefined);
        mocks.deleteTransactions.mockResolvedValue(undefined);
    });

    it('unlinks the transfer partner when a linked transfer is converted', async () => {
        const source: Transaction = {
            id: 'tx-1',
            date: '2026-03-13',
            amount: 12000,
            type: TransactionType.TRANSFER,
            category: 'transfer-card',
            memo: 'Card payment (Transfer)',
            assetId: 'asset-bank',
            toAssetId: 'asset-card',
            linkedTransactionId: 'tx-2',
        };

        const target: Transaction = {
            id: 'tx-2',
            date: '2026-03-13',
            amount: 12000,
            type: TransactionType.TRANSFER,
            category: 'transfer-card',
            memo: 'Card payment target (Transfer)',
            assetId: 'asset-card',
            linkedTransactionId: 'tx-1',
        };

        const converted: Transaction = {
            ...source,
            type: TransactionType.EXPENSE,
            category: 'expense-other',
            toAssetId: undefined,
        };

        const setTransactions = vi.fn();
        const onTransactionChange = vi.fn().mockResolvedValue(undefined);

        const { result } = renderHook(() => (
            useTransactionManager([source, target], setTransactions, onTransactionChange)
        ));

        await act(async () => {
            await result.current.updateTransaction(source, converted);
        });

        expect(mocks.saveTransactions).toHaveBeenCalledWith([
            converted,
            expect.objectContaining({
                id: 'tx-2',
                linkedTransactionId: undefined,
                toAssetId: undefined,
                type: TransactionType.INCOME,
                category: Category.OTHER,
                memo: 'Card payment target',
            }),
        ]);
        expect(onTransactionChange).toHaveBeenCalledTimes(1);
        expect(mocks.addToast).toHaveBeenCalledWith('Linked transfer partner unlinked and converted', 'info');
    });
});

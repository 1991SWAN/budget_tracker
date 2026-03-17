import type { SetStateAction } from 'react';
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssetController } from '../hooks/useAssetController';
import { Asset, AssetType, Transaction, TransactionType } from '../types';

const mocks = vi.hoisted(() => ({
    saveAsset: vi.fn(),
    saveOpeningBalance: vi.fn(),
    deleteAsset: vi.fn(),
    deleteTransactionsByAsset: vi.fn(),
    addTransaction: vi.fn(),
    addToast: vi.fn(),
    setAssets: vi.fn(),
    setTransactions: vi.fn(),
    setSelectedItem: vi.fn(),
    setFormData: vi.fn(),
    setPaymentAsset: vi.fn(),
    setPaymentError: vi.fn(),
    setModalType: vi.fn(),
}));

vi.mock('../services/assetService', () => ({
    AssetService: {
        saveAsset: mocks.saveAsset,
        saveOpeningBalance: mocks.saveOpeningBalance,
        deleteAsset: mocks.deleteAsset,
    },
}));

vi.mock('../services/transactionService', () => ({
    TransactionService: {
        deleteTransactionsByAsset: mocks.deleteTransactionsByAsset,
    },
}));

const bankAsset: Asset = {
    id: 'asset-bank',
    name: 'Main Bank',
    type: AssetType.CHECKING,
    balance: 100000,
    initialBalance: 80000,
    currency: 'KRW',
};

const cardAsset: Asset = {
    id: 'asset-card',
    name: 'Main Card',
    type: AssetType.CREDIT_CARD,
    balance: -45000,
    initialBalance: 0,
    currency: 'KRW',
};

const applyUpdater = <T,>(updater: SetStateAction<T>, current: T): T => (
    typeof updater === 'function'
        ? (updater as (value: T) => T)(current)
        : updater
);

const renderAssetController = (overrides: Partial<Parameters<typeof useAssetController>[0]> = {}) => (
    renderHook(() => useAssetController({
        assets: [bankAsset, cardAsset],
        setAssets: mocks.setAssets,
        setTransactions: mocks.setTransactions,
        addTransaction: mocks.addTransaction,
        addToast: mocks.addToast,
        defaultExpenseCategoryId: 'expense-other',
        defaultIncomeCategoryId: 'income-salary',
        cardPaymentCategoryId: 'transfer-card',
        setSelectedItem: mocks.setSelectedItem,
        setFormData: mocks.setFormData,
        setPaymentAsset: mocks.setPaymentAsset,
        setPaymentError: mocks.setPaymentError,
        setModalType: mocks.setModalType,
        ...overrides,
    }))
);

describe('useAssetController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-17T09:00:00+09:00'));
        mocks.addTransaction.mockResolvedValue(undefined);
        mocks.deleteTransactionsByAsset.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('persists new assets and appends them locally', async () => {
        const newAsset: Asset = {
            id: 'asset-savings',
            name: 'Savings',
            type: AssetType.SAVINGS,
            balance: 500000,
            initialBalance: 500000,
            currency: 'KRW',
        };
        const { result } = renderAssetController();

        await act(async () => {
            await result.current.handleAssetAdd(newAsset);
        });

        expect(mocks.saveAsset).toHaveBeenCalledWith(newAsset);
        expect(mocks.saveOpeningBalance).toHaveBeenCalledWith({
            asset_id: 'asset-savings',
            amount: 500000,
        });

        const updater = mocks.setAssets.mock.calls[0][0];
        expect(applyUpdater(updater, [bankAsset, cardAsset])).toEqual([bankAsset, cardAsset, newAsset]);
    });

    it('saves metadata edits separately from balance adjustments and creates an adjustment transaction', async () => {
        const editedAsset: Asset = {
            ...bankAsset,
            name: 'Main Bank Updated',
            balance: 130000,
        };
        const { result } = renderAssetController();

        await act(async () => {
            await result.current.handleAssetEdit(editedAsset);
        });

        expect(mocks.saveAsset).toHaveBeenCalledWith({
            ...editedAsset,
            balance: bankAsset.balance,
        });
        expect(mocks.saveOpeningBalance).not.toHaveBeenCalled();
        expect(mocks.addTransaction).toHaveBeenCalledWith(expect.objectContaining({
            id: `adj-${Date.now()}`,
            date: '2026-03-17',
            amount: 30000,
            type: TransactionType.INCOME,
            category: 'income-salary',
            memo: 'Manual Balance Adjustment',
            assetId: 'asset-bank',
        }));

        const updater = mocks.setAssets.mock.calls[0][0];
        expect(applyUpdater(updater, [bankAsset, cardAsset])).toEqual([
            { ...editedAsset, balance: bankAsset.balance },
            cardAsset,
        ]);
    });

    it('uses setting mode to persist the edited balance and opening balance without creating an adjustment transaction', async () => {
        const editedAsset = {
            ...bankAsset,
            balance: 150000,
            initialBalance: 90000,
            _adjustmentMode: 'SETTING',
        } as Asset & { _adjustmentMode: string };
        const { result } = renderAssetController();

        await act(async () => {
            await result.current.handleAssetEdit(editedAsset);
        });

        expect(mocks.saveAsset).toHaveBeenCalledWith({
            ...bankAsset,
            balance: 150000,
            initialBalance: 90000,
        });
        expect(mocks.saveOpeningBalance).toHaveBeenCalledWith({
            asset_id: 'asset-bank',
            amount: 90000,
        });
        expect(mocks.addTransaction).not.toHaveBeenCalled();

        const updater = mocks.setAssets.mock.calls[0][0];
        expect(applyUpdater(updater, [bankAsset, cardAsset])).toEqual([
            {
                ...bankAsset,
                balance: 150000,
                initialBalance: 90000,
            },
            cardAsset,
        ]);
    });

    it('clears asset history, removes linked transactions, and resets the balance to initial balance', async () => {
        const transactions: Transaction[] = [
            {
                id: 'tx-1',
                date: '2026-03-10',
                amount: 10000,
                type: TransactionType.EXPENSE,
                category: 'expense-other',
                memo: 'Coffee',
                assetId: 'asset-bank',
            },
            {
                id: 'tx-2',
                date: '2026-03-10',
                amount: 10000,
                type: TransactionType.TRANSFER,
                category: 'transfer-card',
                memo: 'Payoff',
                assetId: 'asset-other',
                toAssetId: 'asset-bank',
            },
            {
                id: 'tx-3',
                date: '2026-03-10',
                amount: 5000,
                type: TransactionType.EXPENSE,
                category: 'expense-other',
                memo: 'Snack',
                assetId: 'asset-card',
            },
        ];
        const { result } = renderAssetController();

        await act(async () => {
            await result.current.handleClearAssetHistory('asset-bank');
        });

        expect(mocks.deleteTransactionsByAsset).toHaveBeenCalledWith('asset-bank');

        const txUpdater = mocks.setTransactions.mock.calls[0][0];
        expect(applyUpdater(txUpdater, transactions)).toEqual([transactions[2]]);

        const assetUpdater = mocks.setAssets.mock.calls[0][0];
        expect(applyUpdater(assetUpdater, [bankAsset, cardAsset])).toEqual([
            { ...bankAsset, balance: bankAsset.initialBalance },
            cardAsset,
        ]);
        expect(mocks.addToast).toHaveBeenCalledWith('History cleared and balance reset to 0.', 'success');
    });

    it('opens the card payment modal with the first non-card asset preselected', () => {
        const { result } = renderAssetController();

        act(() => {
            result.current.openAssetPay(cardAsset);
        });

        expect(mocks.setSelectedItem).toHaveBeenCalledWith(cardAsset);
        expect(mocks.setFormData).toHaveBeenCalledWith({
            amount: 45000,
            date: '2026-03-17',
            memo: 'Credit Card Payoff: Main Card',
            category: 'transfer-card',
        });
        expect(mocks.setPaymentAsset).toHaveBeenCalledWith('asset-bank');
        expect(mocks.setPaymentError).toHaveBeenCalledWith(null);
        expect(mocks.setModalType).toHaveBeenCalledWith('pay-card');
    });
});

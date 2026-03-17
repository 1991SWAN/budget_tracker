import { useCallback } from 'react';
import { Asset, CategoryItem, Transaction, TransactionType } from '../types';

export interface PennyChatAction {
    type: 'CREATE' | 'UPDATE' | 'DELETE' | 'NONE';
    payload: any;
    confirmationRequired: boolean;
}

export interface PennyChatResponse {
    answer: string;
    action?: PennyChatAction;
}

interface UsePennyChatControllerOptions {
    transactions: Transaction[];
    assets: Asset[];
    categories: CategoryItem[];
    addTransaction: (transaction: Transaction) => Promise<void>;
    updateTransaction: (previous: Transaction, next: Transaction) => Promise<void>;
    deleteTransaction: (transaction: Transaction) => Promise<void>;
    refreshTransactions: () => Promise<void> | void;
}

export const usePennyChatController = ({
    transactions,
    assets,
    categories,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refreshTransactions,
}: UsePennyChatControllerOptions) => {
    const submitPrompt = useCallback(async (userInput: string): Promise<PennyChatResponse> => {
        const { GeminiService } = await import('../services/geminiService');
        return await GeminiService.processPennyRequest(userInput, { transactions, assets, categories }) as PennyChatResponse;
    }, [assets, categories, transactions]);

    const confirmAction = useCallback(async (action: PennyChatAction) => {
        const { type, payload } = action;

        if (type === 'DELETE') {
            const target = transactions.find(transaction => transaction.id === payload.id);
            if (!target) {
                throw new Error('Transaction not found for delete action');
            }

            await deleteTransaction(target);
        } else if (type === 'UPDATE') {
            const original = transactions.find(transaction => transaction.id === payload.id);
            if (!original) {
                throw new Error('Transaction not found for update action');
            }

            const updated: Transaction = {
                ...original,
                ...payload,
                category: payload.category_id || payload.category || original.category
            };

            await updateTransaction(original, updated);
        } else if (type === 'CREATE') {
            const newTransaction: Transaction = {
                id: crypto.randomUUID(),
                date: payload.date || new Date().toISOString().split('T')[0],
                amount: payload.amount,
                type: payload.type || TransactionType.EXPENSE,
                category: payload.category_id || categories[0]?.id || '',
                assetId: payload.asset_id || assets[0]?.id || '',
                memo: payload.memo || '',
                merchant: payload.merchant || null,
                timestamp: Date.now()
            };

            await addTransaction(newTransaction);
        }

        await Promise.resolve(refreshTransactions());
    }, [
        addTransaction,
        assets,
        categories,
        deleteTransaction,
        refreshTransactions,
        transactions,
        updateTransaction
    ]);

    return {
        submitPrompt,
        confirmAction,
    };
};

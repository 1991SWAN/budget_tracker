import React, { useState, useCallback } from 'react';
import { Transaction, Asset, TransactionType, Category } from '../types';
import { SupabaseService } from '../services/supabaseService';
import { useToast } from '../contexts/ToastContext';

export const useTransactionManager = (
    transactions: Transaction[],
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>,
    onTransactionChange?: () => Promise<void>
) => {
    const { addToast } = useToast();

    // --- CRUD Operations (Refactored: No Manual Balance Sync, DB Triggers handle it) ---

    const addTransaction = useCallback(async (newTx: Transaction) => {
        try {
            await SupabaseService.saveTransaction(newTx);
            setTransactions(prev => [newTx, ...prev]);
            if (onTransactionChange) await onTransactionChange();
            addToast('Transaction added', 'success');
        } catch (error) {
            console.error('Failed to add transaction', error);
            addToast('Failed to add transaction', 'error');
        }
    }, [setTransactions, addToast]);

    const addTransactions = useCallback(async (newTxs: Transaction[]) => {
        if (newTxs.length === 0) return;
        try {
            await SupabaseService.saveTransactions(newTxs);
            setTransactions(prev => [...newTxs, ...prev]);
            if (onTransactionChange) await onTransactionChange();
            addToast(`${newTxs.length} transactions added`, 'success');
        } catch (error) {
            console.error('Failed to add transactions', error);
            addToast('Failed to add transactions', 'error');
        }
    }, [setTransactions, addToast, onTransactionChange]);

    const updateTransaction = useCallback(async (oldTx: Transaction, newTx: Transaction) => {
        try {
            // 1. Handle Unlinking if type changed FROM transfer TO something else
            if (oldTx.type === TransactionType.TRANSFER && newTx.type !== TransactionType.TRANSFER && oldTx.linkedTransactionId) {
                const linkedTx = transactions.find(t => t.id === oldTx.linkedTransactionId);
                if (linkedTx) {
                    const unlinkedPartner: Transaction = {
                        ...linkedTx,
                        linkedTransactionId: undefined,
                        toAssetId: undefined,
                        type: linkedTx.amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
                        category: Category.OTHER,
                        memo: linkedTx.memo.replace(' (Transfer)', '')
                    };
                    await SupabaseService.saveTransaction(unlinkedPartner);
                    setTransactions(prev => prev.map(t => t.id === unlinkedPartner.id ? unlinkedPartner : t));
                    addToast("Linked transfer partner unlinked and converted", 'info');
                }
            }

            await SupabaseService.saveTransaction(newTx);
            setTransactions(prev => prev.map(t => t.id === newTx.id ? newTx : t));
            if (onTransactionChange) await onTransactionChange();
        } catch (error) {
            console.error('Failed to update transaction', error);
            addToast('Failed to update transaction', 'error');
        }
    }, [setTransactions, transactions, addToast, onTransactionChange]);

    const deleteTransaction = useCallback(async (tx: Transaction) => {
        try {
            if (tx.linkedTransactionId) {
                const linkedTx = transactions.find(t => t.id === tx.linkedTransactionId);
                if (linkedTx) {
                    const unlinkedPartner: Transaction = {
                        ...linkedTx,
                        linkedTransactionId: undefined,
                        toAssetId: undefined,
                        type: linkedTx.amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
                        category: Category.OTHER,
                        memo: linkedTx.memo.replace(' (Transfer)', '')
                    };
                    await updateTransaction(linkedTx, unlinkedPartner);
                    addToast("Linked transfer unlinked", 'info');
                }
            }

            await SupabaseService.deleteTransaction(tx.id);
            setTransactions(prev => prev.filter(t => t.id !== tx.id));
            if (onTransactionChange) await onTransactionChange();
            addToast('Transaction deleted', 'success');
        } catch (error) {
            console.error('Failed to delete transaction', error);
            addToast('Failed to delete transaction', 'error');
        }
    }, [transactions, setTransactions, addToast, updateTransaction, onTransactionChange]);

    const deleteTransactions = useCallback(async (ids: string[]) => {
        if (!ids || ids.length === 0) return;
        try {
            await SupabaseService.deleteTransactions(ids);
            setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
            if (onTransactionChange) await onTransactionChange();
            addToast(`${ids.length} transactions deleted`, 'success');
        } catch (error) {
            console.error('Failed to delete transactions', error);
            addToast('Failed to delete transactions', 'error');
        }
    }, [setTransactions, addToast, onTransactionChange]);

    return {
        addTransaction,
        addTransactions,
        updateTransaction,
        deleteTransaction,
        deleteTransactions
    };
};

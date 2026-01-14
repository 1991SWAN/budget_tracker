import React, { useState, useCallback } from 'react';
import { Transaction, Asset, TransactionType, Category } from '../types';
import { SupabaseService } from '../services/supabaseService';
import { useToast } from '../contexts/ToastContext';

export const useTransactionManager = (
    transactions: Transaction[],
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>,
    assets: Asset[],
    setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
) => {
    const { addToast } = useToast();

    /**
     * Helper to update asset balances based on a transaction delta.
     * This handles both Single Asset transactions and Transfers.
     */
    const applyTransactionToAssets = useCallback((
        currentAssets: Asset[],
        tx: Transaction,
        multiplier: number = 1 // 1 for Add/New, -1 for Delete/Reverse
    ): Asset[] => {
        return currentAssets.map(asset => {
            // 1. Direct Impact (Income/Expense on this asset)
            if (asset.id === tx.assetId && !tx.toAssetId) {
                // Income adds to balance, Expense subtracts.
                // If multiplier is -1 (reversing), Income subtracts, Expense adds.
                const change = tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
                return { ...asset, balance: asset.balance + (change * multiplier) };
            }

            // 2. Transfer Impact (V3 Logic: Positive Amount + ToAssetFlag)
            if (tx.type === TransactionType.TRANSFER) {
                // Case A: Source Account (Money Leaving)
                // Identified by: has 'toAssetId' pointing to destination
                if (asset.id === tx.assetId && tx.toAssetId) {
                    return { ...asset, balance: asset.balance - (tx.amount * multiplier) };
                }

                // Case B: Destination Account (Money Entering)
                // Identified by: has 'linkedTransactionId' but NO 'toAssetId' (or toAssetId is null/empty)
                // Ideally, for the destination record, asset.id IS the effective target.
                // But in our dual-record model:
                // - Source Tx: assetId=A, toAssetId=B
                // - Dest Tx: assetId=B, toAssetId=null (linked to Source)
                if (asset.id === tx.assetId && !tx.toAssetId && tx.linkedTransactionId) {
                    return { ...asset, balance: asset.balance + (tx.amount * multiplier) };
                }
            }

            return asset;
        });
    }, []);

    /**
     * Persists changes to Supabase for any assets that have changed.
     */
    const persistAssetChanges = useCallback(async (oldAssets: Asset[], newAssets: Asset[]) => {
        const promises = newAssets.map(newAsset => {
            const oldAsset = oldAssets.find(a => a.id === newAsset.id);
            if (oldAsset && oldAsset.balance !== newAsset.balance) {
                return SupabaseService.saveAsset(newAsset);
            }
            return Promise.resolve();
        });
        await Promise.all(promises);
    }, []);

    // --- CRUD Operations ---

    const addTransaction = useCallback(async (newTx: Transaction) => {
        try {
            // 1. Save Transaction
            await SupabaseService.saveTransaction(newTx);

            // 2. Update Local Transaction State
            setTransactions(prev => [newTx, ...prev]);

            // 3. Update Assets (Apply +1 effect)
            setAssets(prevAssets => {
                const newAssets = applyTransactionToAssets(prevAssets, newTx, 1);
                persistAssetChanges(prevAssets, newAssets); // Fire and forget persistence
                return newAssets;
            });

            addToast('Transaction added', 'success');
        } catch (error) {
            console.error('Failed to add transaction', error);
            addToast('Failed to add transaction', 'error');
        }
    }, [setTransactions, setAssets, applyTransactionToAssets, persistAssetChanges, addToast]);

    const addTransactions = useCallback(async (newTxs: Transaction[]) => {
        if (newTxs.length === 0) return;
        try {
            // 1. Save All (Batch)
            await SupabaseService.saveTransactions(newTxs);

            // 2. Update Local Transaction State
            setTransactions(prev => [...newTxs, ...prev]); // Prepending batch

            // 3. Update Assets (Loop)
            setAssets(prevAssets => {
                let currentAssets = prevAssets;
                newTxs.forEach(tx => {
                    currentAssets = applyTransactionToAssets(currentAssets, tx, 1);
                });
                persistAssetChanges(prevAssets, currentAssets);
                return currentAssets;
            });

            addToast(`${newTxs.length} transactions added`, 'success');
        } catch (error) {
            console.error('Failed to add transactions', error);
            addToast('Failed to add transactions', 'error');
        }
    }, [setTransactions, setAssets, applyTransactionToAssets, persistAssetChanges, addToast]);

    const updateTransaction = useCallback(async (oldTx: Transaction, newTx: Transaction) => {
        try {
            // 1. Save Transaction
            await SupabaseService.saveTransaction(newTx);

            // 2. Update Local Transaction State
            setTransactions(prev => prev.map(t => t.id === newTx.id ? newTx : t));

            // 3. Update Assets (Reverse Old, Apply New)
            setAssets(prevAssets => {
                // First, reverse the effect of the old transaction
                const reveresedAssets = applyTransactionToAssets(prevAssets, oldTx, -1);
                // Then, apply the effect of the new transaction
                const finalAssets = applyTransactionToAssets(reveresedAssets, newTx, 1);

                persistAssetChanges(prevAssets, finalAssets);
                return finalAssets;
            });
            // Silent success needed for drag-drop reordering sometimes, but Toast is good for manual edits
            // addToast('Transaction updated', 'success');
        } catch (error) {
            console.error('Failed to update transaction', error);
            addToast('Failed to update transaction', 'error');
        }
    }, [setTransactions, setAssets, applyTransactionToAssets, persistAssetChanges, addToast]);

    const deleteTransaction = useCallback(async (tx: Transaction) => {
        try {
            // 1. Handle Linked Transfer Partner (Unlink logic)
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

            // 2. Update Assets (Calculate & Persist BEFORE deleting from DB to ensure rollback potential or just logical order)
            // Actually, for delete, we usually delete from DB first.
            // But to fix the "Side effect in SetState" issue:

            // Calculate new assets based on CURRENT assets (from hook prop)
            const newAssets = applyTransactionToAssets(assets, tx, -1);

            // Persist asset changes to Supabase (Await this!)
            await persistAssetChanges(assets, newAssets);

            // 3. Delete main transaction from DB
            await SupabaseService.deleteTransaction(tx.id);

            // 4. Update Local State (UI)
            setTransactions(prev => prev.filter(t => t.id !== tx.id));
            setAssets(newAssets);

            addToast('Transaction deleted', 'success');
        } catch (error) {
            console.error('Failed to delete transaction', error);
            // Ideally we should revert assets here if they were saved but tx delete failed.
            // For now, at least we log and toast.
            addToast('Failed to delete transaction', 'error');
        }
    }, [transactions, assets, setTransactions, setAssets, applyTransactionToAssets, persistAssetChanges, addToast, updateTransaction]);

    const deleteTransactions = useCallback(async (ids: string[]) => {
        if (!ids || ids.length === 0) return;
        try {
            // 1. Filter transactions to be deleted
            const targets = transactions.filter(t => ids.includes(t.id));
            if (targets.length === 0) return;

            // 2. Calculate Asset Reversion (Batch)
            let currentAssets = [...assets];
            targets.forEach(tx => {
                // Apply reverse effect (-1) cumulatively
                currentAssets = applyTransactionToAssets(currentAssets, tx, -1);
            });

            // 3. Persist Asset Changes
            await persistAssetChanges(assets, currentAssets);

            // 4. Delete from DB
            await SupabaseService.deleteTransactions(ids);

            // 5. Update Local State
            setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
            setAssets(currentAssets);

            addToast(`${ids.length} transactions deleted`, 'success');
        } catch (error) {
            console.error('Failed to delete transactions', error);
            addToast('Failed to delete transactions', 'error');
        }
    }, [transactions, assets, setTransactions, setAssets, applyTransactionToAssets, persistAssetChanges, addToast]);

    return {
        addTransaction,
        addTransactions,
        updateTransaction,
        deleteTransaction,
        deleteTransactions
    };
};

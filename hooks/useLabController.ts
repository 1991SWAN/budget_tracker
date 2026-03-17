import { useCallback, useEffect, useState } from 'react';
import { TransactionService } from '../services/transactionService';
import { Transaction } from '../types';
import { useToast } from '../contexts/ToastContext';

export const useLabController = () => {
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
    const { addToast } = useToast();

    useEffect(() => {
        let isMounted = true;
        const fetchAll = async () => {
            setIsLoading(true);
            try {
                const data = await TransactionService.getTransactions(1000, 0);
                if (isMounted) setAllTransactions(data);
            } catch (error) {
                console.error('Failed to fetch full history for Lab:', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        void fetchAll();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleInlineEdit = useCallback(async (updatedTx: Transaction) => {
        setAllTransactions(previous => previous.map(tx => tx.id === updatedTx.id ? updatedTx : tx));

        try {
            await TransactionService.saveTransaction(updatedTx);
        } catch (error) {
            console.error('Failed to save inline edit:', error);
        }
    }, []);

    const handleToggleDelete = useCallback((tx: Transaction) => {
        setSelectedTxIds(previous => {
            const next = new Set(previous);
            if (next.has(tx.id)) {
                next.delete(tx.id);
            } else {
                next.add(tx.id);
            }
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedTxIds(new Set());
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (selectedTxIds.size === 0) return;

        try {
            await TransactionService.deleteTransactions(Array.from(selectedTxIds));
            setAllTransactions(previous => previous.filter(tx => !selectedTxIds.has(tx.id)));
            clearSelection();
            addToast('Successfully deleted transactions.', 'success');
        } catch (error) {
            console.error('Failed to delete transactions:', error);
            addToast('Failed to delete transactions.', 'error');
        }
    }, [addToast, clearSelection, selectedTxIds]);

    return {
        allTransactions,
        isLoading,
        selectedTxIds,
        handleInlineEdit,
        handleToggleDelete,
        handleConfirmDelete,
        clearSelection,
    };
};

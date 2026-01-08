import { useMemo } from 'react';
import Fuse from 'fuse.js';
import { Transaction } from '../types';

export const useTransactionSearch = (transactions: Transaction[], searchTerm: string) => {
    const fuse = useMemo(() => {
        return new Fuse(transactions, {
            keys: ['memo', 'amount', 'category', 'merchant'],
            threshold: 0.3, // 0.0 = perfect match, 1.0 = match anything
            distance: 100,
            ignoreLocation: true, // find anywhere in string
        });
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        if (!searchTerm.trim()) return transactions;
        return fuse.search(searchTerm).map(result => result.item);
    }, [fuse, searchTerm, transactions]);

    return filteredTransactions;
};

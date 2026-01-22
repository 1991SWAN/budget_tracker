import { useState, useEffect } from 'react';
import { SupabaseService } from '../services/supabaseService';
import { Asset, Transaction, RecurringTransaction, SavingsGoal, TransactionFilters } from '../types';
import { useToast } from '../contexts/ToastContext';

export const useAppData = (user: any) => {
    const { addToast } = useToast();

    const [assets, setAssets] = useState<Asset[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [activeFilters, setActiveFilters] = useState<TransactionFilters | undefined>();
    const PAGE_SIZE = 50;

    const loadData = async (filters?: TransactionFilters) => {
        try {
            if (!user) return;
            setActiveFilters(filters);

            const [txs, assts, recs, gls] = await Promise.all([
                SupabaseService.getTransactions(PAGE_SIZE, 0, filters),
                SupabaseService.getAssets(),
                SupabaseService.getRecurring(),
                SupabaseService.getGoals()
            ]);

            setTransactions(txs);
            setAssets(assts);
            setRecurring(recs);
            setGoals(gls);
            setHasMoreTransactions(txs.length === PAGE_SIZE);

            const profile = await SupabaseService.getProfile();
            setMonthlyBudget(profile?.monthlyBudget || 0);
            setIsDataLoaded(true);
        } catch (e) {
            console.error(e);
            addToast('Failed to load data from cloud', 'error');
        }
    };

    const fetchMoreTransactions = async () => {
        if (isFetchingMore || !hasMoreTransactions || !user) return;
        setIsFetchingMore(true);
        try {
            const nextTxs = await SupabaseService.getTransactions(PAGE_SIZE, transactions.length, activeFilters);
            if (nextTxs.length < PAGE_SIZE) setHasMoreTransactions(false);
            setTransactions(prev => [...prev, ...nextTxs]);
        } catch (e) {
            console.error("Failed to fetch more transactions", e);
        } finally {
            setIsFetchingMore(false);
        }
    };

    useEffect(() => {
        if (user) {
            const timer = setTimeout(() => loadData(), 500);
            return () => clearTimeout(timer);
        } else {
            setTransactions([]);
            setAssets([]);
            setRecurring([]);
            setGoals([]);
            setMonthlyBudget(0);
            setIsDataLoaded(false);
            setHasMoreTransactions(true);
        }
    }, [user]);

    return {
        assets, setAssets,
        transactions, setTransactions,
        hasMoreTransactions,
        fetchMoreTransactions,
        isFetchingMore,
        recurring, setRecurring,
        goals, setGoals,
        monthlyBudget, setMonthlyBudget,
        isDataLoaded,
        refreshData: loadData
    };
};

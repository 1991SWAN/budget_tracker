import { useState, useEffect } from 'react';
import { SupabaseService } from '../services/supabaseService';
import { Asset, Transaction, RecurringTransaction, SavingsGoal } from '../types';
import { useToast } from '../contexts/ToastContext';

export const useAppData = (user: any) => {
    const { addToast } = useToast();

    const [assets, setAssets] = useState<Asset[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const loadData = async () => {
        try {
            console.log('[useAppData] loadData called. User ID:', user?.id);

            if (!user) {
                console.log("[useAppData] No user. Skipping load.");
                return;
            }

            const [txs, assts, recs, gls] = await Promise.all([
                SupabaseService.getTransactions(),
                SupabaseService.getAssets(),
                SupabaseService.getRecurring(),
                SupabaseService.getGoals()
            ]);

            console.log(`[useAppData] Loaded: Txs=${txs.length}, Assets=${assts.length}`);

            setTransactions(txs);
            setAssets(assts);
            setRecurring(recs);
            setGoals(gls);

            // Load Profile for Budget
            const profile = await SupabaseService.getProfile();
            if (profile) {
                setMonthlyBudget(profile.monthlyBudget);
            } else {
                setMonthlyBudget(0);
            }
            setIsDataLoaded(true);
        } catch (e) {
            console.error(e);
            addToast('Failed to load data from cloud', 'error');
        }
    };

    useEffect(() => {
        console.log('[useAppData] Auth State Changed:', user?.id);
        if (user) {
            // Small delay for Auth Session propagation
            const timer = setTimeout(() => {
                loadData();
            }, 500);
            return () => clearTimeout(timer);
        } else {
            // Reset data on logout
            setTransactions([]);
            setAssets([]);
            setRecurring([]);
            setGoals([]);
            setMonthlyBudget(0);
            setIsDataLoaded(false);
        }
    }, [user]);

    return {
        assets, setAssets,
        transactions, setTransactions,
        recurring, setRecurring,
        goals, setGoals,
        monthlyBudget, setMonthlyBudget,
        isDataLoaded,
        refreshData: loadData
    };
};

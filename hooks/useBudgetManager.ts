import { useState, useEffect, useCallback } from 'react';
import { Budget } from '../types';
import { SupabaseService, supabase } from '../services/supabaseService';
import { useToast } from '../contexts/ToastContext';

export const useBudgetManager = () => {
    const { addToast } = useToast();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadBudgets = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await SupabaseService.getBudgets();
            setBudgets(data);
        } catch (error) {
            console.error('Error loading budgets:', error);
            addToast('Failed to load budgets', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    const saveBudget = async (budget: Partial<Budget>) => {
        try {
            const { error } = await SupabaseService.saveBudget(budget);
            if (error) throw error;
            await loadBudgets();
            addToast('Budget saved', 'success');
        } catch (error) {
            console.error('Error saving budget:', error);
            addToast('Failed to save budget', 'error');
            throw error;
        }
    };

    const deleteBudget = async (id: string) => {
        try {
            const { error } = await SupabaseService.deleteBudget(id);
            if (error) throw error;
            await loadBudgets();
            addToast('Budget deleted', 'success');
        } catch (error) {
            console.error('Error deleting budget:', error);
            addToast('Failed to delete budget', 'error');
            throw error;
        }
    };

    const getBudgetForCategory = (categoryId: string) => {
        return budgets.find(b => b.category_id === categoryId);
    };

    useEffect(() => {
        loadBudgets();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                loadBudgets();
            }
        });

        return () => subscription.unsubscribe();
    }, [loadBudgets]);

    return {
        budgets,
        isLoading,
        loadBudgets,
        saveBudget,
        deleteBudget,
        getBudgetForCategory
    };
};

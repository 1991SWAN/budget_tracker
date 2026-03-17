import { useState, useEffect, useCallback, useRef } from 'react';
import { CategoryItem } from '../types';
import { CategoryService } from '../services/categoryService';
import { supabase } from '../services/dbClient';
import { useToast } from '../contexts/ToastContext';

// Robust UUID Generator
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const DEFAULT_CATEGORIES = [
    // Expense - Fixed
    { name: 'Housing & Bill', emoji: '🏠', type: 'EXPENSE', color: 'bg-indigo-500' },
    { name: 'Food & Dining', emoji: '🍔', type: 'EXPENSE', color: 'bg-orange-500' },
    { name: 'Transportation', emoji: '🚌', type: 'EXPENSE', color: 'bg-blue-500' },
    // Expense - Variable
    { name: 'Shopping', emoji: '🛍️', type: 'EXPENSE', color: 'bg-pink-500' },
    { name: 'Health', emoji: '💊', type: 'EXPENSE', color: 'bg-green-500' },
    { name: 'Entertainment', emoji: '🎬', type: 'EXPENSE', color: 'bg-purple-500' },
    { name: 'Education', emoji: '📚', type: 'EXPENSE', color: 'bg-yellow-500' },
    { name: 'Social', emoji: '🤝', type: 'EXPENSE', color: 'bg-rose-500' },
    // Expense - Other
    { name: 'Finance', emoji: '💸', type: 'EXPENSE', color: 'bg-slate-500' },
    { name: 'Pet', emoji: '🐾', type: 'EXPENSE', color: 'bg-amber-500' },
    { name: 'Baby', emoji: '👶', type: 'EXPENSE', color: 'bg-cyan-500' },
    { name: 'Other', emoji: '♾️', type: 'EXPENSE', color: 'bg-slate-400' },
    // Income
    { name: 'Salary', emoji: '💰', type: 'INCOME', color: 'bg-emerald-500' },
    { name: 'Investment', emoji: '📈', type: 'INCOME', color: 'bg-cyan-500' },
    { name: 'Bonus', emoji: '🎁', type: 'INCOME', color: 'bg-teal-500' },
    { name: 'Allowance', emoji: '🪙', type: 'INCOME', color: 'bg-lime-500' },
    { name: 'Refund', emoji: '↩️', type: 'INCOME', color: 'bg-slate-500' },
    // Transfer
    { name: 'Savings/Invest', emoji: '🏦', type: 'TRANSFER', color: 'bg-blue-600' },
    { name: 'Card Payment', emoji: '💳', type: 'TRANSFER', color: 'bg-indigo-600' },
    { name: 'Withdrawal', emoji: '💵', type: 'TRANSFER', color: 'bg-slate-600' },
];

export const useCategoryManager = () => {
    const { addToast } = useToast();
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const isSeeding = useRef(false); // Lock to prevent race conditions

    const loadCategories = useCallback(async (autoSeed = true) => {
        try {
            setIsLoading(true);
            const data = await CategoryService.getCategories();

            if (data.length === 0 && autoSeed) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    // Check if we are really empty before seeding (double check)
                    const { count } = await supabase
                        .from('categories')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', session.user.id);

                    if (!count || count === 0) {
                        addDefaultCategories();
                    }
                    return;
                }
            }
            setCategories(data);
        } catch (error) {
            console.error('Failed to load categories', error);
            addToast('Failed to load categories', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]); // addDefaultCategories is called but defined below. Relying on hoisting or circular reference via useCallback is tricky.

    // Note: addDefaultCategories depends on loadCategories (temporarily removed dependency to avoid cycle if possible, or handle carefully)

    const addDefaultCategories = useCallback(async () => {
        if (isSeeding.current) return;
        isSeeding.current = true;
        setIsLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) return; // User must be logged in

            // Final Safety Check
            const { count } = await supabase.from('categories').select('*', { count: 'exact', head: true }).eq('user_id', userId);
            if (count && count > 0) return;

            const newCategories = DEFAULT_CATEGORIES.map((d, index) => ({
                id: generateUUID(),
                user_id: userId,
                name: d.name,
                emoji: d.emoji,
                type: d.type as any,
                is_default: true,
                sort_order: index,
                color: d.color
            }));

            const { error } = await supabase.from('categories').upsert(newCategories, {
                onConflict: 'user_id, name, type',
                ignoreDuplicates: true
            });
            if (!error) {
                console.log('Auto-seeded default categories (Upsert completed).');
                // Refresh categories
                const data = await CategoryService.getCategories();
                setCategories(data);
            }
        } finally {
            setIsLoading(false);
            isSeeding.current = false;
        }
    }, [addToast]);

    const resetCategories = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            await supabase.from('categories').delete().eq('user_id', session.user.id);
            setCategories([]);
            addToast('Categories reset. Re-seeding...', 'success');
            setTimeout(() => addDefaultCategories(), 500);
        } catch (error) {
            console.error(error);
            addToast('Failed to reset', 'error');
            setIsLoading(false);
        }
    }, [addToast, addDefaultCategories]);

    // Initial Load & Auth Listener
    useEffect(() => {
        loadCategories();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                loadCategories();
            }
        });
        return () => subscription.unsubscribe();
    }, [loadCategories]);

    // CRUD Operations
    const addCategory = useCallback(async (name: string, type: 'EXPENSE' | 'INCOME', emoji: string = '🏷️', color: string = 'bg-slate-500', keywords: string[] = []) => {
        try {
            const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0);
            const newCategory: CategoryItem = {
                id: generateUUID(),
                user_id: '',
                name, emoji, type, color, keywords,
                is_default: false,
                sort_order: maxOrder + 1,
                created_at: new Date().toISOString()
            };
            setCategories(prev => [...prev, newCategory]);
            await CategoryService.saveCategory(newCategory);
            addToast('Category added', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to add category', 'error');
            loadCategories(false);
        }
    }, [categories, addToast, loadCategories]);

    const updateCategory = useCallback(async (updatedCategory: CategoryItem) => {
        try {
            setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
            await CategoryService.saveCategory(updatedCategory);
            addToast('Category updated', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to update category', 'error');
            loadCategories(false);
        }
    }, [addToast, loadCategories]);

    const deleteCategory = useCallback(async (id: string) => {
        const target = categories.find(c => c.id === id);
        if (target?.is_default) {
            addToast('Cannot delete default category', 'error');
            return;
        }
        try {
            setCategories(prev => prev.filter(c => c.id !== id));
            await CategoryService.deleteCategory(id);
            addToast('Category deleted', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to delete category', 'error');
            loadCategories(false);
        }
    }, [categories, addToast, loadCategories]);

    const reorderCategories = useCallback(async (reorderedCategories: CategoryItem[]) => {
        setCategories(reorderedCategories);
        const updates = reorderedCategories.map((cat, index) => {
            if (cat.sort_order !== index) return { ...cat, sort_order: index };
            return null;
        }).filter(Boolean) as CategoryItem[];

        if (updates.length > 0) {
            try {
                await Promise.all(updates.map(cat => CategoryService.saveCategory(cat)));
            } catch (error) {
                console.error(error);
                addToast('Failed to save order', 'error');
                loadCategories(false);
            }
        }
    }, [addToast, loadCategories]);

    return {
        categories,
        isLoading,
        addCategory,
        updateCategory,
        deleteCategory,
        reorderCategories,
        addDefaultCategories,
        resetCategories,
        refreshCategories: loadCategories
    };
};

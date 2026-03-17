import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { SupabaseService } from '../services/supabaseService';
import { BillType, CategoryId, CategoryItem, RecurringTransaction, SavingsGoal, Transaction, TransactionType } from '../types';
import { getDefaultCategoryId, normalizeCategoryId } from '../utils/category';
import type { ModalFormSetter, ModalSelectedItemSetter, ModalTypeSetter } from './modalTypes';

interface UsePlanningControllerOptions {
    categories: CategoryItem[];
    goals: SavingsGoal[];
    setGoals: Dispatch<SetStateAction<SavingsGoal[]>>;
    setRecurring: Dispatch<SetStateAction<RecurringTransaction[]>>;
    setMonthlyBudget: Dispatch<SetStateAction<number>>;
    addTransaction: (transaction: Transaction) => Promise<void>;
    defaultExpenseCategoryId: CategoryId;
    goalTransferCategoryId: CategoryId;
    normalizeTransactionCategory: (type: TransactionType, category?: string | null) => CategoryId;
    setModalType: ModalTypeSetter;
    setSelectedItem: ModalSelectedItemSetter;
    setFormData: ModalFormSetter;
}

export const usePlanningController = ({
    categories,
    goals,
    setGoals,
    setRecurring,
    setMonthlyBudget,
    addTransaction,
    defaultExpenseCategoryId,
    goalTransferCategoryId,
    normalizeTransactionCategory,
    setModalType,
    setSelectedItem,
    setFormData,
}: UsePlanningControllerOptions) => {
    const handleBudgetChange = useCallback(async (amount: number) => {
        setMonthlyBudget(amount);
        await SupabaseService.saveProfile({ monthly_budget: amount });
    }, [setMonthlyBudget]);

    const deleteRecurringById = useCallback((id: string) => {
        void SupabaseService.deleteRecurring(id);
        setRecurring(previous => previous.filter(recurringItem => recurringItem.id !== id));
    }, [setRecurring]);

    const deleteGoalById = useCallback((id: string) => {
        void SupabaseService.deleteGoal(id);
        setGoals(previous => previous.filter(goal => goal.id !== id));
    }, [setGoals]);

    const handleRecurringChange = useCallback((action: 'add' | 'update' | 'delete' | 'pay', item: any) => {
        if (action === 'delete' && item.id) {
            deleteRecurringById(item.id);
            return;
        }

        if (action === 'add') {
            const newRecurring: RecurringTransaction = {
                ...item,
                id: Date.now().toString(),
                category: normalizeCategoryId(item.category, categories, {
                    type: 'EXPENSE',
                    preferredNames: ['Housing & Bill', 'Other'],
                    fallbackValue: defaultExpenseCategoryId
                })
            };

            void SupabaseService.saveRecurring(newRecurring);
            setRecurring(previous => [...previous, newRecurring]);
            return;
        }

        if (action === 'update') {
            const updatedRecurring: RecurringTransaction = {
                ...item,
                category: normalizeCategoryId(item.category, categories, {
                    type: 'EXPENSE',
                    preferredNames: ['Housing & Bill', 'Other'],
                    fallbackValue: defaultExpenseCategoryId
                })
            };

            void SupabaseService.saveRecurring(updatedRecurring);
            setRecurring(previous => previous.map(recurringItem => (
                recurringItem.id === updatedRecurring.id ? updatedRecurring : recurringItem
            )));
            return;
        }

        if (action === 'pay') {
            void addTransaction({
                id: `bp-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                amount: item.amount,
                type: TransactionType.EXPENSE,
                category: normalizeTransactionCategory(TransactionType.EXPENSE, item.category),
                memo: `Bill Pay: ${item.name}`,
                assetId: item.assetId
            });
        }
    }, [addTransaction, categories, defaultExpenseCategoryId, deleteRecurringById, normalizeTransactionCategory, setRecurring]);

    const handleGoalChange = useCallback((action: 'add' | 'update' | 'delete' | 'contribute', item: any) => {
        if (action === 'delete' && item.id) {
            deleteGoalById(item.id);
            return;
        }

        if (action === 'add') {
            const newGoal = { ...item, id: Date.now().toString() };
            void SupabaseService.saveGoal(newGoal);
            setGoals(previous => [...previous, newGoal]);
            return;
        }

        if (action === 'update') {
            void SupabaseService.saveGoal(item);
            setGoals(previous => previous.map(goal => (
                goal.id === item.id ? { ...goal, ...item } : goal
            )));
            return;
        }

        if (action === 'contribute') {
            const currentGoal = goals.find(goal => goal.id === item.id);
            if (!currentGoal) return;

            const updatedGoal = {
                ...currentGoal,
                currentAmount: currentGoal.currentAmount + item.amount
            };
            void SupabaseService.saveGoal(updatedGoal);
            setGoals(previous => previous.map(goal => (
                goal.id === item.id ? updatedGoal : goal
            )));

            void addTransaction({
                id: `gc-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                amount: item.amount,
                type: TransactionType.TRANSFER,
                category: goalTransferCategoryId,
                memo: `Goal: ${item.name}`,
                assetId: item.assetId,
                toAssetId: item.toAssetId
            });
        }
    }, [addTransaction, deleteGoalById, goalTransferCategoryId, goals, setGoals]);

    const openAddBillToGroup = useCallback((group: string) => {
        setModalType('bill');
        setSelectedItem(null);
        setFormData({
            name: '',
            amount: '',
            dayOfMonth: 1,
            category: getDefaultCategoryId(categories, 'EXPENSE', ['Housing & Bill', 'Other']),
            billType: BillType.SUBSCRIPTION,
            groupName: group
        });
    }, [categories, setFormData, setModalType, setSelectedItem]);

    return {
        handleBudgetChange,
        handleRecurringChange,
        handleGoalChange,
        openAddBillToGroup,
        deleteRecurringById,
        deleteGoalById,
    };
};

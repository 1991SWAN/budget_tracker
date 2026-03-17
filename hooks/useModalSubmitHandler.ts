import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { SupabaseService } from '../services/supabaseService';
import { Asset, AssetType, BillType, CategoryId, CategoryItem, RecurringTransaction, SavingsGoal, Transaction, TransactionType } from '../types';
import { normalizeCategoryId } from '../utils/category';
import type {
    BillModalForm,
    BudgetModalForm,
    FundGoalModalForm,
    GoalModalForm,
    ModalFormData,
    ModalSelectedItem,
    ModalType,
    PayCardModalForm
} from './modalTypes';

interface UseModalSubmitHandlerOptions {
    modalType: ModalType;
    formData: ModalFormData;
    selectedItem: ModalSelectedItem;
    paymentAsset: string;
    destinationAsset: string;
    setPaymentError: (message: string | null) => void;
    assets: Asset[];
    categories: CategoryItem[];
    goals: SavingsGoal[];
    setRecurring: Dispatch<SetStateAction<RecurringTransaction[]>>;
    setGoals: Dispatch<SetStateAction<SavingsGoal[]>>;
    closeModal: () => void;
    addToast: (message: string, type?: string) => void;
    addTransaction: (transaction: Transaction) => Promise<void>;
    addTransactions: (transactions: Transaction[]) => Promise<void>;
    handleBudgetChange: (amount: number) => Promise<void>;
    normalizeTransactionCategory: (type: TransactionType, category?: string | null) => CategoryId;
    defaultExpenseCategoryId: CategoryId;
    cardPaymentCategoryId: CategoryId;
    goalTransferCategoryId: CategoryId;
}

export const useModalSubmitHandler = ({
    modalType,
    formData,
    selectedItem,
    paymentAsset,
    destinationAsset,
    setPaymentError,
    assets,
    categories,
    goals,
    setRecurring,
    setGoals,
    closeModal,
    addToast,
    addTransaction,
    addTransactions,
    handleBudgetChange,
    normalizeTransactionCategory,
    defaultExpenseCategoryId,
    cardPaymentCategoryId,
    goalTransferCategoryId,
}: UseModalSubmitHandlerOptions) => {
    return useCallback(async () => {
        setPaymentError(null);
        const billForm = formData as BillModalForm;
        const goalForm = formData as GoalModalForm;
        const budgetForm = formData as BudgetModalForm;
        const payCardForm = formData as PayCardModalForm;
        const fundGoalForm = formData as FundGoalModalForm;
        const selectedBill = selectedItem as RecurringTransaction | null;
        const selectedGoal = selectedItem as SavingsGoal | null;
        const selectedAsset = selectedItem as Asset | null;

        if (modalType === 'budget') {
            await handleBudgetChange(Number(budgetForm.amount));
            closeModal();
            return;
        }

        if (modalType === 'pay-card' || modalType === 'pay-bill' || modalType === 'fund-goal') {
            const sourceAsset = assets.find(asset => asset.id === paymentAsset);
            const amountToPay = Number(
                (modalType === 'pay-card' ? payCardForm.amount : fundGoalForm.amount)
                || selectedBill?.amount
                || selectedGoal?.currentAmount
                || 0
            );

            if (sourceAsset && sourceAsset.type !== AssetType.CREDIT_CARD && sourceAsset.balance < amountToPay) {
                setPaymentError(`Insufficient funds in ${sourceAsset.name}. Available: ${sourceAsset.balance.toLocaleString()}`);
                return;
            }
        }

        if (modalType === 'pay-card' && selectedAsset) {
            const payAmount = Number(payCardForm.amount);
            const sourceId = crypto.randomUUID();
            const targetId = crypto.randomUUID();

            const sourceTransaction: Transaction = {
                id: sourceId,
                date: payCardForm.date || new Date().toISOString().split('T')[0],
                timestamp: Date.now(),
                amount: payAmount,
                type: TransactionType.TRANSFER,
                category: normalizeTransactionCategory(TransactionType.TRANSFER, payCardForm.category || cardPaymentCategoryId),
                memo: payCardForm.memo || `Credit Card Payoff: ${selectedAsset.name}`,
                assetId: paymentAsset,
                toAssetId: selectedAsset.id,
                linkedTransactionId: targetId
            };

            const targetTransaction: Transaction = {
                ...sourceTransaction,
                id: targetId,
                assetId: selectedAsset.id,
                toAssetId: undefined,
                linkedTransactionId: sourceId
            };

            await addTransactions([sourceTransaction, targetTransaction]);
            closeModal();
            return;
        }

        if (modalType === 'bill') {
            const nextRecurring: RecurringTransaction = {
                id: selectedBill?.id || Date.now().toString(),
                name: billForm.name,
                amount: Number(billForm.amount),
                dayOfMonth: Number(billForm.dayOfMonth),
                category: normalizeCategoryId(billForm.category, categories, {
                    type: 'EXPENSE',
                    preferredNames: ['Housing & Bill', 'Other'],
                    fallbackValue: defaultExpenseCategoryId
                }),
                billType: billForm.billType,
                groupName: billForm.groupName || 'Default'
            } as RecurringTransaction & { groupName?: string };

            await SupabaseService.saveRecurring(nextRecurring);

            if (selectedBill) {
                setRecurring(previous => previous.map(recurringItem => (
                    recurringItem.id === nextRecurring.id ? nextRecurring : recurringItem
                )));
                addToast('Bill updated', 'success');
            } else {
                setRecurring(previous => [...previous, nextRecurring]);
                addToast('Bill added', 'success');
            }
        } else if (modalType === 'goal') {
            const nextGoal: SavingsGoal = {
                id: selectedGoal?.id || Date.now().toString(),
                name: goalForm.name,
                targetAmount: Number(goalForm.targetAmount),
                emoji: goalForm.emoji,
                deadline: goalForm.deadline,
                currentAmount: selectedGoal?.currentAmount || 0
            };

            await SupabaseService.saveGoal(nextGoal);

            if (selectedGoal) {
                setGoals(previous => previous.map(goal => (
                    goal.id === nextGoal.id ? nextGoal : goal
                )));
                addToast('Goal updated', 'success');
            } else {
                setGoals(previous => [...previous, nextGoal]);
                addToast('Goal added', 'success');
            }
        } else if (modalType === 'pay-bill' && selectedBill) {
            await addTransaction({
                id: `bp-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                amount: selectedBill.amount,
                type: TransactionType.EXPENSE,
                category: normalizeTransactionCategory(TransactionType.EXPENSE, selectedBill.category),
                memo: `Bill Pay: ${selectedBill.name}`,
                assetId: paymentAsset
            });
            addToast('Bill paid successfully', 'success');
        } else if (modalType === 'fund-goal' && selectedGoal) {
            const amount = Number(fundGoalForm.amount);
            const targetGoal = goals.find(goal => goal.id === selectedGoal.id);

            if (targetGoal) {
                const updatedGoal = { ...targetGoal, currentAmount: targetGoal.currentAmount + amount };
                await SupabaseService.saveGoal(updatedGoal);
                setGoals(previous => previous.map(goal => (
                    goal.id === updatedGoal.id ? updatedGoal : goal
                )));
            }

            const sourceId = crypto.randomUUID();
            const targetId = crypto.randomUUID();

            const sourceTransaction: Transaction = {
                id: sourceId,
                date: new Date().toISOString().split('T')[0],
                timestamp: Date.now(),
                amount,
                type: TransactionType.TRANSFER,
                category: goalTransferCategoryId,
                memo: `Goal: ${selectedGoal.name}`,
                assetId: paymentAsset,
                toAssetId: destinationAsset || undefined,
                linkedTransactionId: targetId
            };

            if (sourceTransaction.toAssetId) {
                const targetTransaction: Transaction = {
                    ...sourceTransaction,
                    id: targetId,
                    assetId: sourceTransaction.toAssetId,
                    toAssetId: undefined,
                    linkedTransactionId: sourceId
                };
                await addTransactions([sourceTransaction, targetTransaction]);
            } else {
                await addTransaction(sourceTransaction);
            }

            addToast('Funds added to goal', 'success');
        }

        closeModal();
    }, [
        addToast,
        addTransaction,
        addTransactions,
        assets,
        cardPaymentCategoryId,
        categories,
        closeModal,
        defaultExpenseCategoryId,
        destinationAsset,
        formData,
        goalTransferCategoryId,
        goals,
        handleBudgetChange,
        modalType,
        normalizeTransactionCategory,
        paymentAsset,
        selectedItem,
        setGoals,
        setPaymentError,
        setRecurring
    ]);
};

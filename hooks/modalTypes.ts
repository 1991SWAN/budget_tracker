import type { Dispatch, SetStateAction } from 'react';
import { Asset, BillType, CategoryId, RecurringTransaction, SavingsGoal } from '../types';

export type ModalType = 'bill' | 'goal' | 'pay-bill' | 'fund-goal' | 'budget' | 'pay-card' | 'import' | null;

type ModalNumberish = number | string;

export interface BillModalForm {
    name: string;
    amount: ModalNumberish;
    dayOfMonth: ModalNumberish;
    category: CategoryId;
    billType: BillType;
    groupName?: string;
}

export interface GoalModalForm {
    name: string;
    targetAmount: ModalNumberish;
    emoji: string;
    deadline: string;
}

export interface BudgetModalForm {
    amount: ModalNumberish;
}

export interface PayCardModalForm {
    amount: ModalNumberish;
    date: string;
    memo: string;
    category: CategoryId;
}

export interface FundGoalModalForm {
    amount: ModalNumberish;
}

export type ImportModalForm = Record<string, never>;

export type ModalFormData =
    | BillModalForm
    | GoalModalForm
    | BudgetModalForm
    | PayCardModalForm
    | FundGoalModalForm
    | ImportModalForm;

export type ModalSelectedItem = RecurringTransaction | SavingsGoal | Asset | null;
export type ModalFormSetter = Dispatch<SetStateAction<ModalFormData>>;
export type ModalSelectedItemSetter = Dispatch<SetStateAction<ModalSelectedItem>>;
export type ModalTypeSetter = Dispatch<SetStateAction<ModalType>>;

export const createImportModalForm = (): ImportModalForm => ({});

export const createBillModalForm = (
    defaultCategoryId: CategoryId,
    overrides: Partial<BillModalForm> = {}
): BillModalForm => ({
    name: '',
    amount: '',
    dayOfMonth: 1,
    category: defaultCategoryId,
    billType: BillType.SUBSCRIPTION,
    ...overrides,
});

export const toBillModalForm = (bill: RecurringTransaction): BillModalForm => ({
    name: bill.name,
    amount: bill.amount,
    dayOfMonth: bill.dayOfMonth,
    category: bill.category,
    billType: bill.billType,
    groupName: (bill as RecurringTransaction & { groupName?: string }).groupName || '',
});

export const createGoalModalForm = (
    overrides: Partial<GoalModalForm> = {}
): GoalModalForm => ({
    name: '',
    targetAmount: '',
    emoji: '🎯',
    deadline: '',
    ...overrides,
});

export const toGoalModalForm = (goal: SavingsGoal): GoalModalForm => ({
    name: goal.name,
    targetAmount: goal.targetAmount,
    emoji: goal.emoji || '🎯',
    deadline: goal.deadline || '',
});

export const createBudgetModalForm = (amount: ModalNumberish): BudgetModalForm => ({
    amount,
});

export const createPayCardModalForm = (
    card: Asset,
    defaultCategoryId: CategoryId
): PayCardModalForm => ({
    amount: Math.abs(card.balance),
    date: new Date().toISOString().split('T')[0],
    memo: `Credit Card Payoff: ${card.name}`,
    category: defaultCategoryId,
});

export const createFundGoalModalForm = (): FundGoalModalForm => ({
    amount: '',
});

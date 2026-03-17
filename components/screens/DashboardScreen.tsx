import React from 'react';
import Dashboard from '../Dashboard';
import { Asset, CategoryItem, RecurringTransaction, SavingsGoal, Transaction } from '../../types';
import { RegularCandidate } from '../../hooks/useRegularExpenseDetector';

interface DashboardScreenProps {
    transactions: Transaction[];
    assets: Asset[];
    recurring: RecurringTransaction[];
    goals: SavingsGoal[];
    categories: CategoryItem[];
    monthlyBudget: number;
    onRecurringChange: (action: 'add' | 'update' | 'delete' | 'pay', item: any) => void;
    onGoalChange: (action: 'add' | 'update' | 'delete' | 'contribute', item: any) => void;
    onEditTransaction: (transactionId: string) => void;
    onInlineEdit?: (transaction: Transaction) => void;
    onDeleteTransaction: (transactionId: string) => void;
    onBudgetChange: (amount: number) => void;
    onNavigateToTransactions: (dateRange?: { start: string, end: string } | null) => void;
    onAddBillToGroup: (group: string) => void;
    regularCandidates: RegularCandidate[];
    regularCandidateTxIds: Set<string>;
    onRegisterRegular: (candidate: RegularCandidate) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
    onEditTransaction,
    ...props
}) => {
    return (
        <Dashboard
            {...props}
            onEditTransaction={transaction => onEditTransaction(transaction.id)}
        />
    );
};

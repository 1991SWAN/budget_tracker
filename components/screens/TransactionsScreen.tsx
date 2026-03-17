import React from 'react';
import ErrorBoundary from '../ErrorBoundary';
import FilterBar from '../FilterBar';
import TransactionList from '../TransactionList';
import { Asset, CategoryItem, RecurringTransaction, Transaction, TransactionType } from '../../types';
import { RegularCandidate } from '../../hooks/useRegularExpenseDetector';

interface TransactionsScreenProps {
    transactions: Transaction[];
    assets: Asset[];
    categories: CategoryItem[];
    recurring: RecurringTransaction[];
    searchTerm: string;
    dateRange: { start: string, end: string } | null;
    filterType: TransactionType | 'ALL';
    filterSubExpense: 'ALL' | 'REGULAR' | 'INSTALLMENT';
    filterCategories: string[];
    filterAssets: string[];
    isReviewActive: boolean;
    reviewCount: number;
    regularCandidates: RegularCandidate[];
    regularCandidateTxIds: Set<string>;
    hasMoreTransactions: boolean;
    isFetchingMore: boolean;
    onSearchChange: (term: string) => void;
    onDateRangeChange: (range: { start: string, end: string } | null) => void;
    onTypeChange: (type: TransactionType | 'ALL') => void;
    onSubExpenseChange: (type: 'ALL' | 'REGULAR' | 'INSTALLMENT') => void;
    onCategoriesChange: (ids: string[]) => void;
    onAssetsChange: (ids: string[]) => void;
    onReviewToggle: (active: boolean) => void;
    onEditTransaction: (transactionId: string) => void;
    onInlineEdit?: (transaction: Transaction) => void;
    onDeleteTransaction: (transactionId: string) => void;
    onDeleteTransactions: (ids: string[]) => void;
    onLoadMore: () => void;
    onRegisterRegular: (candidate: RegularCandidate) => void;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
    transactions,
    assets,
    categories,
    recurring,
    searchTerm,
    dateRange,
    filterType,
    filterSubExpense,
    filterCategories,
    filterAssets,
    isReviewActive,
    reviewCount,
    regularCandidates,
    regularCandidateTxIds,
    hasMoreTransactions,
    isFetchingMore,
    onSearchChange,
    onDateRangeChange,
    onTypeChange,
    onSubExpenseChange,
    onCategoriesChange,
    onAssetsChange,
    onReviewToggle,
    onEditTransaction,
    onInlineEdit,
    onDeleteTransaction,
    onDeleteTransactions,
    onLoadMore,
    onRegisterRegular
}) => {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                    <div>
                        <h1 className="text-3xl font-bold text-primary">Transactions</h1>
                        <p className="text-muted">Review and manage your financial history.</p>
                    </div>
                    <div className="flex gap-2">
                        {dateRange && (
                            <button
                                onClick={() => onDateRangeChange(null)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold hover:bg-slate-200"
                            >
                                Clear Date
                            </button>
                        )}
                    </div>
                </div>

                <FilterBar
                    searchTerm={searchTerm}
                    onSearchChange={onSearchChange}
                    dateRange={dateRange}
                    onDateRangeChange={onDateRangeChange}
                    filterType={filterType}
                    onTypeChange={onTypeChange}
                    filterSubExpense={filterSubExpense}
                    onSubExpenseChange={onSubExpenseChange}
                    filterCategories={filterCategories}
                    onCategoriesChange={onCategoriesChange}
                    filterAssets={filterAssets}
                    onAssetsChange={onAssetsChange}
                    assets={assets}
                    categories={categories}
                    isReviewActive={isReviewActive}
                    onReviewToggle={onReviewToggle}
                    reviewCount={reviewCount}
                />
            </div>

            <ErrorBoundary>
                <TransactionList
                    transactions={transactions}
                    assets={assets}
                    categories={categories}
                    onEdit={transaction => onEditTransaction(transaction.id)}
                    onInlineEdit={onInlineEdit}
                    onDelete={transaction => onDeleteTransaction(transaction.id)}
                    onDeleteTransactions={onDeleteTransactions}
                    searchTerm={searchTerm}
                    onLoadMore={onLoadMore}
                    hasMore={hasMoreTransactions}
                    isFetchingMore={isFetchingMore}
                    candidates={regularCandidates}
                    candidateTxIds={regularCandidateTxIds}
                    onRegisterRegular={onRegisterRegular}
                    recurring={recurring}
                />
            </ErrorBoundary>
        </div>
    );
};

import { useCallback, useEffect, useState } from 'react';
import { TransactionFilters, TransactionType, View } from '../types';

interface UseAppViewStateOptions {
    loadData: (filters?: TransactionFilters) => Promise<void> | void;
}

export const useAppViewState = ({ loadData }: UseAppViewStateOptions) => {
    const [view, setView] = useState<View>('dashboard');
    const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
    const [filterSubExpense, setFilterSubExpense] = useState<'ALL' | 'REGULAR' | 'INSTALLMENT'>('ALL');
    const [filterCategories, setFilterCategories] = useState<string[]>([]);
    const [filterAssets, setFilterAssets] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<{ start: string, end: string } | null>(null);
    const [isReviewActive, setIsReviewActive] = useState(false);
    const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
    const [isPennyChatOpen, setIsPennyChatOpen] = useState(false);

    const navigateTo = useCallback((nextView: View) => {
        if (nextView === 'analysis') {
            setIsPennyChatOpen(true);
            return;
        }

        setView(nextView);
        window.history.pushState({ view: nextView }, '', '');
    }, []);

    const closeReconciliation = useCallback(() => {
        setIsReviewActive(false);
        setIsReconciliationModalOpen(false);
    }, []);

    const toggleReview = useCallback((active: boolean) => {
        setIsReviewActive(active);
        setIsReconciliationModalOpen(active);
    }, []);

    const openPennyChat = useCallback(() => {
        setIsPennyChatOpen(true);
    }, []);

    const closePennyChat = useCallback(() => {
        setIsPennyChatOpen(false);
    }, []);

    useEffect(() => {
        window.history.replaceState({ view: 'dashboard' }, '', '');

        const handlePopState = (event: PopStateEvent) => {
            if (event.state?.view) {
                setView(event.state.view);
                return;
            }

            setView('dashboard');
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            void loadData({
                searchTerm,
                type: filterType,
                expenseType: filterSubExpense,
                categories: filterCategories,
                assets: filterAssets,
                dateRange: isReviewActive ? null : dateRange
            });
        }, 300);

        return () => clearTimeout(handler);
    }, [
        dateRange,
        filterAssets,
        filterCategories,
        filterSubExpense,
        filterType,
        isReviewActive,
        loadData,
        searchTerm
    ]);

    return {
        view,
        navigateTo,
        filterType,
        setFilterType,
        filterSubExpense,
        setFilterSubExpense,
        filterCategories,
        setFilterCategories,
        filterAssets,
        setFilterAssets,
        searchTerm,
        setSearchTerm,
        dateRange,
        setDateRange,
        isReviewActive,
        isReconciliationModalOpen,
        toggleReview,
        closeReconciliation,
        isPennyChatOpen,
        openPennyChat,
        closePennyChat,
    };
};

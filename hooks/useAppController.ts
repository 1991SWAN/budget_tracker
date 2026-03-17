import { useCallback, useMemo, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import {
    CategoryId,
    TransactionType,
} from '../types';
import { AssetService } from '../services/assetService';
import { useAppData } from './useAppData';
import { useAppViewState } from './useAppViewState';
import { useCategoryManager } from './useCategoryManager';
import { useTransactionManager } from './useTransactionManager';
import { useModalClose } from './useModalClose';
import { useModalManager } from './useModalManager';
import { useTransactionController } from './useTransactionController';
import { usePlanningController } from './usePlanningController';
import { useAssetController } from './useAssetController';
import { useModalSubmitHandler } from './useModalSubmitHandler';
import { usePennyChatController } from './usePennyChatController';
import { useTransferReconciler } from './useTransferReconciler';
import { getDefaultCategoryId, normalizeCategoryId } from '../utils/category';

export const useAppController = (user: any) => {
    const { addToast } = useToast();
    const {
        assets,
        setAssets,
        transactions,
        setTransactions,
        recurring,
        setRecurring,
        goals,
        setGoals,
        monthlyBudget,
        setMonthlyBudget,
        hasMoreTransactions,
        fetchMoreTransactions,
        isFetchingMore,
        refreshData: loadData
    } = useAppData(user);
    const { categories } = useCategoryManager();

    const normalizeTransactionCategory = useCallback((
        type: TransactionType,
        category?: string | null
    ): CategoryId => {
        if (type === TransactionType.INCOME) {
            return normalizeCategoryId(category, categories, {
                type: 'INCOME',
                preferredNames: ['Salary', 'Investment']
            });
        }

        if (type === TransactionType.TRANSFER) {
            return normalizeCategoryId(category, categories, {
                type: 'TRANSFER',
                preferredNames: ['Card Payment', 'Savings/Invest', 'Withdrawal']
            });
        }

        return normalizeCategoryId(category, categories, {
            type: 'EXPENSE',
            preferredNames: ['Other', 'Housing & Bill']
        });
    }, [categories]);

    const defaultExpenseCategoryId = useMemo(
        () => getDefaultCategoryId(categories, 'EXPENSE', ['Other', 'Housing & Bill']),
        [categories]
    );
    const defaultIncomeCategoryId = useMemo(
        () => getDefaultCategoryId(categories, 'INCOME', ['Salary', 'Investment']),
        [categories]
    );
    const cardPaymentCategoryId = useMemo(
        () => getDefaultCategoryId(categories, 'TRANSFER', ['Card Payment', 'Savings/Invest']),
        [categories]
    );
    const goalTransferCategoryId = useMemo(
        () => getDefaultCategoryId(categories, 'TRANSFER', ['Savings/Invest', 'Card Payment']),
        [categories]
    );

    const {
        modalType,
        setModalType,
        selectedItem,
        setSelectedItem,
        formData,
        setFormData,
        paymentAsset,
        setPaymentAsset,
        destinationAsset,
        setDestinationAsset,
        paymentError,
        setPaymentError,
        closeModal: closeManagedModal,
    } = useModalManager(assets, categories);

    const modalRef = useRef<HTMLDivElement>(null);
    const [assetFormRequestKey, setAssetFormRequestKey] = useState(0);

    const refreshAssets = useCallback(async () => {
        const freshAssets = await AssetService.getAssets();
        setAssets(freshAssets);
    }, [setAssets]);

    const {
        addTransaction,
        addTransactions,
        updateTransaction,
        updateTransactions,
        deleteTransaction,
        deleteTransactions
    } = useTransactionManager(transactions, setTransactions, refreshAssets);
    const viewState = useAppViewState({ loadData });
    const handleAddAssetRequest = useCallback(() => {
        viewState.navigateTo('assets');
        setAssetFormRequestKey(previous => previous + 1);
    }, [viewState.navigateTo]);

    const {
        candidates: transferCandidates,
        singleCandidates,
        handleLink,
        handleConvert,
        handleIgnore
    } = useTransferReconciler(transactions, assets, categories, () => loadData());

    const transactionController = useTransactionController({
        user,
        assets,
        categories,
        transactions,
        recurring,
        setRecurring,
        setModalType,
        addToast,
        addTransaction,
        addTransactions,
        updateTransaction,
        updateTransactions,
        deleteTransaction,
        defaultExpenseCategoryId,
        normalizeTransactionCategory
    });

    const closeModal = useCallback(() => {
        closeManagedModal();
        transactionController.clearPendingImportFile();
    }, [closeManagedModal, transactionController]);

    useModalClose(!!modalType, closeModal, modalRef);

    const planningController = usePlanningController({
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
        setFormData
    });

    const assetController = useAssetController({
        assets,
        setAssets,
        setTransactions,
        addTransaction,
        addToast,
        defaultExpenseCategoryId,
        defaultIncomeCategoryId,
        cardPaymentCategoryId,
        setSelectedItem,
        setFormData,
        setPaymentAsset,
        setPaymentError,
        setModalType
    });

    const handleModalSubmit = useModalSubmitHandler({
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
        handleBudgetChange: planningController.handleBudgetChange,
        normalizeTransactionCategory,
        defaultExpenseCategoryId,
        cardPaymentCategoryId,
        goalTransferCategoryId
    });

    const handleModalDelete = useCallback(async () => {
        if (modalType === 'bill' && selectedItem && 'id' in selectedItem) {
            planningController.deleteRecurringById(selectedItem.id);
            closeModal();
            return;
        }

        if (modalType === 'goal' && selectedItem && 'id' in selectedItem) {
            planningController.deleteGoalById(selectedItem.id);
            closeModal();
        }
    }, [closeModal, modalType, planningController, selectedItem]);

    const pennyChatController = usePennyChatController({
        transactions,
        assets,
        categories,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        refreshTransactions: loadData
    });

    const closeOverlay = useCallback(() => {
        closeModal();
        transactionController.closeSmartInput();
        viewState.closeReconciliation();
        viewState.closePennyChat();
    }, [closeModal, transactionController, viewState]);

    return {
        shell: {
            view: viewState.view,
            onNavigate: viewState.navigateTo,
            onImportClick: () => transactionController.openImport(),
            onImportFile: (file: File) => transactionController.openImport(file),
            onQuickAddClick: transactionController.openQuickAdd,
            onAddAsset: handleAddAssetRequest
        },
        actions: {
            openQuickAdd: transactionController.openQuickAdd,
            openEditTransaction: transactionController.openEditTransaction,
            openImport: transactionController.openImport,
            openPennyChat: viewState.openPennyChat,
            openReconciliation: () => viewState.toggleReview(true),
            closeOverlay,
            refreshTransactions: loadData
        },
        screens: {
            dashboard: {
                transactions,
                assets,
                recurring,
                goals,
                categories,
                monthlyBudget,
                onRecurringChange: planningController.handleRecurringChange,
                onGoalChange: planningController.handleGoalChange,
                onEditTransaction: transactionController.openEditTransaction,
                onInlineEdit: transactionController.handleInlineUpdate,
                onDeleteTransaction: transactionController.deleteTransactionById,
                onBudgetChange: planningController.handleBudgetChange,
                onNavigateToTransactions: (range?: { start: string, end: string } | null) => {
                    if (range) viewState.setDateRange(range);
                    viewState.navigateTo('transactions');
                },
                onAddBillToGroup: planningController.openAddBillToGroup,
                regularCandidates: transactionController.regularCandidates,
                regularCandidateTxIds: transactionController.regularCandidateTxIds,
                onRegisterRegular: transactionController.handleRegisterRegular
            },
            transactions: {
                transactions,
                assets,
                categories,
                recurring,
                searchTerm: viewState.searchTerm,
                dateRange: viewState.dateRange,
                filterType: viewState.filterType,
                filterSubExpense: viewState.filterSubExpense,
                filterCategories: viewState.filterCategories,
                filterAssets: viewState.filterAssets,
                isReviewActive: viewState.isReviewActive,
                reviewCount: transferCandidates.length + singleCandidates.length,
                regularCandidates: transactionController.regularCandidates,
                regularCandidateTxIds: transactionController.regularCandidateTxIds,
                hasMoreTransactions,
                isFetchingMore,
                onSearchChange: viewState.setSearchTerm,
                onDateRangeChange: viewState.setDateRange,
                onTypeChange: viewState.setFilterType,
                onSubExpenseChange: viewState.setFilterSubExpense,
                onCategoriesChange: viewState.setFilterCategories,
                onAssetsChange: viewState.setFilterAssets,
                onReviewToggle: viewState.toggleReview,
                onEditTransaction: transactionController.openEditTransaction,
                onInlineEdit: transactionController.handleInlineUpdate,
                onDeleteTransaction: transactionController.deleteTransactionById,
                onDeleteTransactions: deleteTransactions,
                onLoadMore: fetchMoreTransactions,
                onRegisterRegular: transactionController.handleRegisterRegular
            },
            assets: {
                assets,
                transactions,
                createRequestKey: assetFormRequestKey,
                onAdd: assetController.handleAssetAdd,
                onEdit: assetController.handleAssetEdit,
                onDelete: assetController.handleAssetDelete,
                onPay: assetController.openAssetPay,
                onClearHistory: assetController.handleClearAssetHistory
            }
        },
        overlays: {
            modalHost: {
                modalType,
                selectedItem,
                formData,
                setFormData,
                paymentAsset,
                setPaymentAsset,
                destinationAsset,
                setDestinationAsset,
                paymentError,
                closeModal,
                handleSubmit: handleModalSubmit,
                assets,
                categories,
                onDeleteSelected: handleModalDelete,
                modalRef
            },
            reconciliation: {
                isOpen: viewState.isReconciliationModalOpen,
                onClose: viewState.closeReconciliation,
                candidates: transferCandidates,
                singleCandidates,
                assets,
                categories,
                onLink: handleLink,
                onConvert: handleConvert,
                onIgnore: handleIgnore
            },
            importWizard: {
                isOpen: modalType === 'import',
                onClose: closeModal,
                onConfirm: transactionController.handleImportConfirm,
                assetId: transactionController.importAssetId,
                assetName: assets.find(asset => asset.id === transactionController.importAssetId)?.name || 'Account',
                assets,
                categories,
                initialFile: transactionController.pendingImportFile || undefined
            },
            smartInput: {
                isOpen: transactionController.isSmartInputOpen,
                onTransactionsParsed: transactionController.editingTransaction
                    ? transactionController.handleUpdateParsed
                    : transactionController.handleSmartParsed,
                onCancel: transactionController.closeSmartInput,
                assets,
                categories,
                initialData: transactionController.editingTransaction,
                transactions,
                onDelete: transactionController.deleteTransactionById
            },
            pennyChat: {
                isOpen: viewState.isPennyChatOpen,
                onClose: viewState.closePennyChat,
                categories,
                onSubmitPrompt: pennyChatController.submitPrompt,
                onConfirmAction: pennyChatController.confirmAction
            }
        }
    };
};

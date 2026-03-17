import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ImportService } from '../services/importService';
import { RecurringService } from '../services/recurringService';
import { RegularCandidate, useGlobalRegularExpenseDetector } from './useRegularExpenseDetector';
import { AssetType, CategoryId, CategoryItem, RecurringTransaction, Transaction, TransactionType, Asset, BillType } from '../types';
import { normalizeCategoryId } from '../utils/category';
import { parseTransactionDetailsInput } from '../utils/transactionDetails';
import type { ModalTypeSetter } from './modalTypes';

interface UseTransactionControllerOptions {
    user: any;
    assets: Asset[];
    categories: CategoryItem[];
    transactions: Transaction[];
    recurring: RecurringTransaction[];
    setRecurring: Dispatch<SetStateAction<RecurringTransaction[]>>;
    setModalType: ModalTypeSetter;
    addToast: (message: string, type?: string) => void;
    addTransaction: (transaction: Transaction) => Promise<void>;
    addTransactions: (transactions: Transaction[]) => Promise<void>;
    updateTransaction: (previous: Transaction, next: Transaction) => Promise<void>;
    updateTransactions: (transactions: Transaction[]) => Promise<void>;
    deleteTransaction: (transaction: Transaction) => Promise<void>;
    defaultExpenseCategoryId: CategoryId;
    normalizeTransactionCategory: (type: TransactionType, category?: string | null) => CategoryId;
}

export const useTransactionController = ({
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
    normalizeTransactionCategory,
}: UseTransactionControllerOptions) => {
    const [isSmartInputOpen, setIsSmartInputOpen] = useState(false);
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [importAssetId, setImportAssetId] = useState('');
    const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

    const editingTransaction = useMemo(
        () => transactions.find(transaction => transaction.id === editingTransactionId) || null,
        [editingTransactionId, transactions]
    );

    const {
        candidates: regularCandidates,
        candidateTxIds: regularCandidateTxIds
    } = useGlobalRegularExpenseDetector(user, recurring);

    const normalizeDraftDetails = useCallback((draft: Partial<Transaction>) => {
        if (draft.memo === undefined) {
            return {
                memo: draft.memo,
                merchant: draft.merchant,
                tags: draft.tags,
            };
        }

        const parsed = parseTransactionDetailsInput(String(draft.memo || ''));
        return {
            memo: parsed.memo,
            merchant: parsed.merchant || null,
            tags: parsed.tags,
        };
    }, []);

    const openQuickAdd = useCallback(() => {
        setEditingTransactionId(null);
        setIsSmartInputOpen(true);
    }, []);

    const openEditTransaction = useCallback((transactionId: string) => {
        setEditingTransactionId(transactionId);
        setIsSmartInputOpen(true);
    }, []);

    const closeSmartInput = useCallback(() => {
        setIsSmartInputOpen(false);
        setEditingTransactionId(null);
    }, []);

    const clearPendingImportFile = useCallback(() => {
        setPendingImportFile(null);
    }, []);

    const deleteTransactionById = useCallback(async (transactionId: string) => {
        const transaction = transactions.find(item => item.id === transactionId);
        if (!transaction) return;

        await deleteTransaction(transaction);
    }, [deleteTransaction, transactions]);

    const handleInlineUpdate = useCallback(async (updatedTransaction: Transaction) => {
        const previous = transactions.find(transaction => transaction.id === updatedTransaction.id);

        if (previous) {
            await updateTransaction(previous, updatedTransaction);
            return;
        }

        await updateTransactions([updatedTransaction]);
    }, [transactions, updateTransaction, updateTransactions]);

    const handleRegisterRegular = useCallback((candidate: RegularCandidate) => {
        const nextRecurring: RecurringTransaction = {
            id: Date.now().toString(),
            name: candidate.name,
            amount: Math.abs(candidate.averageAmount),
            dayOfMonth: new Date(candidate.lastDate).getDate(),
            category: defaultExpenseCategoryId,
            billType: BillType.SUBSCRIPTION
        };

        void RecurringService.saveRecurring(nextRecurring);
        setRecurring(previous => [...previous, nextRecurring]);
        addToast('New regular bill added!', 'success');
    }, [addToast, defaultExpenseCategoryId, setRecurring]);

    const handleSmartParsed = useCallback(async (parsedTransactions: Partial<Transaction>[]) => {
        if (editingTransaction && parsedTransactions.length > 0) {
            const updates = parsedTransactions[0];
            const normalizedDetails = normalizeDraftDetails(updates);
            const updatedTransaction: Transaction = {
                ...editingTransaction,
                ...updates,
                date: updates.date || editingTransaction.date,
                amount: updates.amount !== undefined ? updates.amount : editingTransaction.amount,
                category: normalizeTransactionCategory(
                    updates.type || editingTransaction.type,
                    (updates.category as string | undefined) || editingTransaction.category
                ),
                memo: normalizedDetails.memo === undefined ? editingTransaction.memo : normalizedDetails.memo,
                merchant: normalizedDetails.merchant === undefined ? editingTransaction.merchant : normalizedDetails.merchant || undefined,
                tags: normalizedDetails.tags === undefined ? editingTransaction.tags : normalizedDetails.tags,
                assetId: updates.assetId || editingTransaction.assetId
            };

            await updateTransaction(editingTransaction, updatedTransaction);
            closeSmartInput();
            return;
        }

        const defaultAssetId = assets[0]?.id || '1';
        const normalizedTransactions = parsedTransactions.map(parsedTransaction => {
            const type = parsedTransaction.type || TransactionType.EXPENSE;
            const normalizedDetails = normalizeDraftDetails(parsedTransaction);

            return {
                id: parsedTransaction.id || crypto.randomUUID(),
                date: parsedTransaction.date || new Date().toISOString().split('T')[0],
                timestamp: parsedTransaction.timestamp || Date.now(),
                amount: parsedTransaction.amount || 0,
                type,
                category: normalizeTransactionCategory(type, parsedTransaction.category as string | undefined),
                memo: normalizedDetails.memo || (normalizedDetails.merchant ? '' : 'Smart Entry'),
                merchant: normalizedDetails.merchant || undefined,
                tags: normalizedDetails.tags,
                assetId: parsedTransaction.assetId || defaultAssetId,
                toAssetId: parsedTransaction.toAssetId,
                installment: parsedTransaction.installment
            } as Transaction;
        });

        if (normalizedTransactions.length > 1) {
            await addTransactions(normalizedTransactions);
        } else if (normalizedTransactions[0]) {
            await addTransaction(normalizedTransactions[0]);
        }

        normalizedTransactions.forEach(transaction => {
            if (!transaction.installment) return;

            const newBill: RecurringTransaction = {
                id: `inst-bill-${transaction.id}`,
                name: `${transaction.memo || transaction.merchant || 'Installment'} (Installment)`,
                amount: Math.floor(transaction.amount / transaction.installment.totalMonths),
                dayOfMonth: new Date(transaction.date).getDate(),
                category: normalizeCategoryId(transaction.category, categories, {
                    type: 'EXPENSE',
                    preferredNames: ['Other', 'Housing & Bill'],
                    fallbackValue: defaultExpenseCategoryId
                }),
                billType: BillType.INSTALLMENT,
                installmentDetails: {
                    startDate: transaction.date,
                    totalAmount: transaction.amount,
                    totalMonths: transaction.installment.totalMonths,
                    isInterestFree: transaction.installment.isInterestFree
                }
            };

            setRecurring(previous => [...previous, newBill]);
        });

        closeSmartInput();
    }, [
        addTransaction,
        addTransactions,
        assets,
        categories,
        closeSmartInput,
        defaultExpenseCategoryId,
        editingTransaction,
        normalizeDraftDetails,
        normalizeTransactionCategory,
        setRecurring,
        updateTransaction
    ]);

    const handleUpdateParsed = useCallback(async (parsedTransactions: Partial<Transaction>[]) => {
        if (editingTransaction && parsedTransactions.length > 0) {
            const updates = parsedTransactions
                .map(parsedTransaction => {
                    const original = parsedTransaction.id === editingTransaction.id
                        ? editingTransaction
                        : transactions.find(transaction => transaction.id === parsedTransaction.id);

                    if (!original) return null;

                    const mergedTransaction = {
                        ...original,
                        ...parsedTransaction,
                        category: normalizeTransactionCategory(
                            parsedTransaction.type || original.type,
                            (parsedTransaction.category as string | undefined) || original.category
                        )
                    };

                    if (parsedTransaction.memo === undefined) {
                        return mergedTransaction as Transaction;
                    }

                    const normalizedDetails = normalizeDraftDetails(parsedTransaction);
                    return {
                        ...mergedTransaction,
                        memo: normalizedDetails.memo,
                        merchant: normalizedDetails.merchant || undefined,
                        tags: normalizedDetails.tags,
                    } as Transaction;
                })
                .filter(Boolean) as Transaction[];

            if (updates.length > 1) {
                await updateTransactions(updates);
            } else if (updates.length === 1) {
                await updateTransaction(editingTransaction, updates[0]);
            }
        }

        closeSmartInput();
    }, [
        closeSmartInput,
        editingTransaction,
        normalizeDraftDetails,
        normalizeTransactionCategory,
        transactions,
        updateTransaction,
        updateTransactions
    ]);

    const openImport = useCallback((file?: File) => {
        setPendingImportFile(file || null);

        if (!importAssetId || !assets.find(asset => asset.id === importAssetId)) {
            const defaultAccount = assets.find(asset => asset.type === AssetType.CHECKING) || assets[0];
            if (defaultAccount) {
                setImportAssetId(defaultAccount.id);
            }
        }

        setModalType('import');
    }, [assets, importAssetId, setModalType]);

    const handleImportConfirm = useCallback(async (newTransactions: Transaction[]) => {
        const replaceTransactions = newTransactions.filter(transaction => (transaction as any).replaceTargetId);
        const normalTransactions = newTransactions.filter(transaction => !(transaction as any).replaceTargetId);

        const { finalNewTxs, updatedExistingTxs } = ImportService.processImportedTransactions(normalTransactions, transactions);

        if (finalNewTxs.length > 0) {
            const readyTransactions = finalNewTxs.map(transaction => ({
                ...transaction,
                id: transaction.id || crypto.randomUUID()
            }));
            await addTransactions(readyTransactions as Transaction[]);
        }

        if (updatedExistingTxs.length > 0) {
            await updateTransactions(updatedExistingTxs);
        }

        if (replaceTransactions.length > 0) {
            const existingTransactionsById = new Map(transactions.map(transaction => [transaction.id, transaction]));
            const updates = replaceTransactions.map(transaction => {
                const nextTransaction = { ...transaction } as any;
                const targetId = nextTransaction.replaceTargetId;
                delete nextTransaction.replaceTargetId;
                const existingTransaction = targetId ? existingTransactionsById.get(targetId) : undefined;

                return {
                    ...existingTransaction,
                    ...nextTransaction,
                    id: targetId,
                    category: existingTransaction?.category ?? nextTransaction.category,
                    tags: existingTransaction?.tags ?? nextTransaction.tags,
                    isReconciliationIgnored: existingTransaction?.isReconciliationIgnored ?? nextTransaction.isReconciliationIgnored,
                };
            }) as Transaction[];
            await updateTransactions(updates);
        }

        addToast(
            `Import Processed: ${finalNewTxs.length} new, ${replaceTransactions.length} replaced, ${updatedExistingTxs.length} transfer matches`,
            'success'
        );
    }, [addToast, addTransactions, transactions, updateTransactions]);

    return {
        isSmartInputOpen,
        editingTransaction,
        importAssetId,
        pendingImportFile,
        regularCandidates,
        regularCandidateTxIds,
        openQuickAdd,
        openEditTransaction,
        closeSmartInput,
        clearPendingImportFile,
        deleteTransactionById,
        handleInlineUpdate,
        handleRegisterRegular,
        handleSmartParsed,
        handleUpdateParsed,
        openImport,
        handleImportConfirm,
    };
};

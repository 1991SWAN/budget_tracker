import { useState, useCallback, useEffect } from 'react';
import { Transaction, TransactionType, Asset, AssetType, Category, CategoryItem } from '../types';
import { SupabaseService } from '../services/supabaseService';

interface TransferCandidate {
    withdrawal: Transaction; // The one that will be the SOURCE (Money Leaving)
    deposit: Transaction;    // The one that will be the DESTINATION (Money Entering)
    score: number;
    timeDiff: number;
}

interface SingleCandidate {
    transaction: Transaction; // The Expense Transaction
    targetAsset: Asset;       // The Detected Liability Asset
    matchReason: string;      // e.g. "Memo 'Amex' matched Asset 'Amex Card'"
}

export const useTransferReconciler = (
    transactions: Transaction[],
    assets: Asset[],
    categories: CategoryItem[],
    onRefresh: () => void
) => {
    const [candidates, setCandidates] = useState<TransferCandidate[]>([]);
    const [singleCandidates, setSingleCandidates] = useState<SingleCandidate[]>([]);
    const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
    const [isScanning, setIsScanning] = useState(false);
    const [lastScanCount, setLastScanCount] = useState(0);

    /**
     * Scan for potential transfer pairs AND single-sided payments.
     * V3 Window: 5 Minutes.
     * Target: Unlinked Income/Expense pairs with same Absolute Amount.
     */
    const scanCandidates = useCallback(async () => {
        setIsScanning(true);
        try {
            const { pairs, singles } = await SupabaseService.getReconciliationCandidates();
            console.log(`[TransferReconciler] Received from server: ${pairs?.length || 0} Pairs, ${singles?.length || 0} Singles`);

            // Further filter by ignoredIds in memory for immediate UI response
            const filteredPairs = (pairs || []).filter(p => !ignoredIds.has(p.withdrawal.id) && !ignoredIds.has(p.deposit.id));
            const filteredSingles = (singles || []).filter(s => !ignoredIds.has(s.transaction.id));

            setCandidates(filteredPairs);
            setSingleCandidates(filteredSingles);
            setLastScanCount(filteredPairs.length + filteredSingles.length);

            console.log(`[TransferReconciler] FINAL UI STATE: ${filteredPairs.length} Pairs, ${filteredSingles.length} Singles. (Total: ${filteredPairs.length + filteredSingles.length})`);
        } catch (error) {
            console.error("[TransferReconciler] Failed to scan candidates:", error);
        } finally {
            setIsScanning(false);
        }
    }, [ignoredIds]);

    /**
     * Trigger Scan on Mount or Transaction Change
     */
    useEffect(() => {
        if (transactions.length > 0 && !isScanning) {
            console.log(`[TransferReconciler] Data changed (${transactions.length} txs). Triggering fresh scan...`);
            scanCandidates();
        }
    }, [scanCandidates, transactions]); // Full array dependency for robust triggering

    /**
     * EXECUTE LINK (Pair)
     */
    const handleLink = async (candidate: TransferCandidate) => {
        const { withdrawal, deposit } = candidate;

        // 1. Prepare Updates
        const sourceUpdate = {
            id: withdrawal.id,
            type: TransactionType.TRANSFER,
            toAssetId: deposit.assetId,
            linkedTransactionId: deposit.id,
        };

        const targetUpdate = {
            id: deposit.id,
            type: TransactionType.TRANSFER,
            toAssetId: null as unknown as string,
            linkedTransactionId: withdrawal.id,
        };

        try {
            await SupabaseService.linkTransactionsV3(sourceUpdate, targetUpdate);
            // Session-level ignore to prevent reappearing during background refresh
            setIgnoredIds(prev => {
                const updated = new Set(prev);
                updated.add(withdrawal.id);
                updated.add(deposit.id);
                return updated;
            });
            onRefresh();
            setCandidates(prev => prev.filter(c => c.withdrawal.id !== withdrawal.id));
        } catch (error) {
            console.error("Failed to link transactions:", error);
            alert("Failed to link transactions. Please try again.");
        }
    };

    /**
     * EXECUTE CONVERT (Single)
     */
    const handleConvert = async (candidate: SingleCandidate) => {
        const { transaction, targetAsset } = candidate;

        // Determine proper Transfer Category
        // Strict Mode: MUST find a "Payment" related category.

        let targetCategoryId: string | null = null;

        if (categories && categories.length > 0) {
            const transferCategories = categories.filter(c => c.type === 'TRANSFER');

            const paymentCategory = transferCategories.find(c =>
                c.name.toLowerCase().includes('card') ||
                c.name.toLowerCase().includes('payment') ||
                c.name.toLowerCase().includes('결제')
            );

            if (paymentCategory) {
                targetCategoryId = paymentCategory.id;
            }
        }

        // Strict Enforcement
        if (!targetCategoryId) {
            alert("To convert to a payment, you must have a Transfer Category named 'Card Payment' or '결제'. Please create one in Settings.");
            return;
        }

        try {
            // New Logic: Create Counterpart Transaction Pair via Service
            await SupabaseService.createTransferPair(transaction, targetAsset.id, targetCategoryId);

            // Session-level ignore
            setIgnoredIds(prev => {
                const updated = new Set(prev);
                updated.add(transaction.id);
                return updated;
            });
            onRefresh();
            setSingleCandidates(prev => prev.filter(c => c.transaction.id !== transaction.id));
        } catch (error) {
            console.error("Failed to convert transaction:", error);
            alert("Failed to convert transaction. Please try again.");
        }
    };



    const handleIgnore = async (id: string, isSingle: boolean = false) => {
        // Find the transaction object to update
        const txToIgnore = transactions.find(t => t.id === id);
        if (!txToIgnore) return;

        try {
            // Update in DB
            await SupabaseService.saveTransaction({
                ...txToIgnore,
                isReconciliationIgnored: true
            });

            // Local state update for immediate UI feedback
            setIgnoredIds(prev => {
                const updated = new Set(prev);
                updated.add(id);
                return updated;
            });

            if (isSingle) {
                setSingleCandidates(prev => prev.filter(c => c.transaction.id !== id));
            } else {
                setCandidates(prev => prev.filter(c => c.withdrawal.id !== id));
            }

            // Trigger parent refresh to sync data
            onRefresh();
        } catch (error) {
            console.error("Failed to ignore transaction:", error);
            alert("Failed to ignore transaction. Please try again.");
        }
    };

    return {
        candidates,
        singleCandidates,
        isScanning,
        scanCandidates,
        handleLink,
        handleConvert,
        handleIgnore
    };
};

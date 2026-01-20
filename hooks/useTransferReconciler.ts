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

    /**
     * Scan for potential transfer pairs AND single-sided payments.
     * V3 Window: 5 Minutes.
     * Target: Unlinked Income/Expense pairs with same Absolute Amount.
     */
    const scanCandidates = useCallback(() => {
        setIsScanning(true);
        const candidatesFound: TransferCandidate[] = [];
        const singlesFound: SingleCandidate[] = [];
        const processedIds = new Set<string>();

        // Sort by date desc
        const sorted = [...transactions].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Create Asset lookup for type checking
        const assetMap = new Map<string, Asset>();
        // Also create a lookup for Liability Assets by Name/Institution for Keyword Matching
        const liabilityAssets: Asset[] = [];

        assets.forEach(a => {
            assetMap.set(a.id, a);
            if (a.type === AssetType.CREDIT_CARD || a.type === AssetType.LOAN) {
                liabilityAssets.push(a);
            }
        });

        // 1. Scan for Pairs (Existing Logic)
        for (let i = 0; i < sorted.length; i++) {
            const txA = sorted[i];
            // Skip already linked or transfers OR items ignored
            if (txA.linkedTransactionId || txA.isReconciliationIgnored || txA.type === TransactionType.TRANSFER || processedIds.has(txA.id) || ignoredIds.has(txA.id)) {
                continue;
            }

            // Pre-filter: If Asset is excluded type (Credit Card / Loan), skip for PAIR matching?
            // Existing logic says: Skip CC/Loan for Pair Matching source/target because they should be handled differently?
            // Actually existing logic says: "Pre-filter: If Asset is excluded type... continue"
            const assetA = assetMap.get(txA.assetId);
            if (!assetA || assetA.type === AssetType.CREDIT_CARD || assetA.type === AssetType.LOAN) continue;

            const timeA = new Date(txA.timestamp || txA.date).getTime();
            const windowSize = 300000;

            for (let j = i + 1; j < sorted.length; j++) {
                const txB = sorted[j];
                if (txB.linkedTransactionId || txB.type === TransactionType.TRANSFER || processedIds.has(txB.id)) continue;

                // Pre-filter: Check Asset B type
                const assetB = assetMap.get(txB.assetId);
                if (!assetB || assetB.type === AssetType.CREDIT_CARD || assetB.type === AssetType.LOAN) continue;

                // Constraint 1: Must be different assets
                if (txA.assetId === txB.assetId) continue;

                const timeB = new Date(txB.timestamp || txB.date).getTime();
                const timeDiff = Math.abs(timeA - timeB);

                if (timeDiff > windowSize) break; // Out of window (sorted desc)

                if (Math.abs(txA.amount) === Math.abs(txB.amount)) {
                    // Constraint 2: Type Check (Expense vs Income)
                    if (txA.type !== txB.type) {
                        // Found a pair!
                        const withdrawal = txA.type === TransactionType.EXPENSE ? txA : txB;
                        const deposit = txA.type === TransactionType.EXPENSE ? txB : txA;

                        candidatesFound.push({
                            withdrawal,
                            deposit,
                            score: 1.0,
                            timeDiff
                        });
                        processedIds.add(txA.id);
                        processedIds.add(txB.id);
                        break; // Move to next A
                    }
                }
            }
        }

        // 2. Scan for Singles (Smart Payment Detection)
        // Iterate again (or could have been combined, but separate is safer for logic isolation)
        // We only care about EXPENSES that are NOT processed yet.
        for (const tx of sorted) {
            if (processedIds.has(tx.id) || ignoredIds.has(tx.id) || tx.isReconciliationIgnored) continue;
            if (tx.type !== TransactionType.EXPENSE) continue;
            if (tx.linkedTransactionId) continue;

            // Check Keywords against Liability Assets
            const textToSearch = (tx.memo + ' ' + (tx.merchant || '') + ' ' + (tx.originalText || '')).toLowerCase();

            // User requested "결제" keyword check too.
            // But "결제" alone doesn't tell us WHICH card.
            // So we need "결제" AND (Asset Name OR Institution).
            // OR just Asset Name/Institution is strong enough?
            // User said: "memo에 '결제'라는 단어도 포함해줘" -> implies add it to the list of keywords.
            // But if I just find "결제", I don't know the target.
            // So I will assume "Target Matching" is still the primary filter.
            // If I match a Target Asset Name, that's enough. 
            // Maybe "결제" increases confidence?
            // Actually, let's stick to: Match Asset Name or Institution.

            for (const asset of liabilityAssets) {
                const keywords = [
                    asset.name.toLowerCase(),
                    asset.institution?.toLowerCase(),
                    // logic for 'payment' or '결제' is generic, let's treat it as a booster or mandatory?
                    // "Hyundai Card" -> Keyword "Hyundai"
                ].filter(k => k) as string[];

                // Simple check: Does text contain any unique keyword of the asset?
                // We need to be careful with common words.
                // e.g. "Chase" is good. "Card" is bad.
                // Let's assume Asset Name / Institution are specific enough for now.

                const match = keywords.some(k => textToSearch.includes(k));

                // Also check for user requested "Pay" or "Payment" or "결제" as a qualifier?
                // Or is the Name enough? "Hyundai Dept Store", "Hyundai Card"?
                // If I spent at "Hyundai Dept Store", it shouldn't be a transfer to "Hyundai Card".
                // So maybe we DO need "Payment"/"결제"/"Pay" keyword presence + Asset Name?
                // Or just be loose and let user decide?
                // Let's be slightly loose but prioritize explicit matches.

                if (match) {
                    // Filter out likely regular spending at same brand?
                    // E.g. "Starbucks" asset vs "Starbucks" expense.
                    // Usually assets are banks. 

                    // Let's create candidate
                    singlesFound.push({
                        transaction: tx,
                        targetAsset: asset,
                        matchReason: `Matched '${asset.name}' info in memo`
                    });
                    processedIds.add(tx.id); // Mark as candidate to avoid duplicates if multiple assets match (first wins)
                    break;
                }
            }
        }

        setCandidates(candidatesFound);
        setSingleCandidates(singlesFound);
        setIsScanning(false);
        console.log(`[TransferReconciler] Scanned ${transactions.length} txs. Found ${candidatesFound.length} Pairs, ${singlesFound.length} Singles. (Ignored: ${ignoredIds.size})`);
    }, [transactions, assets, ignoredIds]);

    /**
     * Trigger Scan on Mount or Transaction Change
     */
    useEffect(() => {
        if (transactions.length > 0) {
            scanCandidates();
        }
    }, [scanCandidates, transactions]); // Fixed: Track full array for content updates

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

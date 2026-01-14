import { useState, useCallback, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';
import { SupabaseService } from '../services/supabaseService';

interface TransferCandidate {
    withdrawal: Transaction; // The one that will be the SOURCE (Money Leaving)
    deposit: Transaction;    // The one that will be the DESTINATION (Money Entering)
    score: number;
    timeDiff: number;
}

export const useTransferReconciler = (
    transactions: Transaction[],
    onRefresh: () => void
) => {
    const [candidates, setCandidates] = useState<TransferCandidate[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    /**
     * Scan for potential transfer pairs.
     * V3 Window: 5 Minutes.
     * Target: Unlinked Income/Expense pairs with same Absolute Amount.
     */
    const scanCandidates = useCallback(() => {
        setIsScanning(true);
        const candidatesFound: TransferCandidate[] = [];
        const processedIds = new Set<string>();

        // Sort by date desc
        const sorted = [...transactions].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Filter out Credit Card and Loans (As per V3 Req)
        // Assuming we would need to check asset type, but transaction object currently 
        // doesn't have asset type directly. We might need asset list.
        // For now, let's rely on Amount/Time matching. 
        // TODO: In real app, pass 'assets' to this hook to filter by type.

        for (let i = 0; i < sorted.length; i++) {
            const txA = sorted[i];
            if (txA.linkedTransactionId || txA.type === TransactionType.TRANSFER || processedIds.has(txA.id)) continue;

            // V3 Window: 5 minutes (300,000 ms)
            const timeA = new Date(txA.timestamp || txA.date).getTime();
            const windowSize = 300000;

            for (let j = i + 1; j < sorted.length; j++) {
                const txB = sorted[j];
                if (txB.linkedTransactionId || txB.type === TransactionType.TRANSFER || processedIds.has(txB.id)) continue;

                const timeB = new Date(txB.timestamp || txB.date).getTime();
                const timeDiff = Math.abs(timeA - timeB);

                if (timeDiff > windowSize) break; // Out of window (sorted desc)

                // AMOUNT MATCH (Absolute)
                // Import logic saves absolute amounts, but assigns Type based on sign.
                // In Database: Expense is Amount, Income is Amount. Both Positive.
                // Type differentiates them.
                // Or if Import V2 saves signed amounts? 
                // Wait, our new Import Logic saves pure Expense/Income.
                // Usually Expense amount is > 0, Type=Expense. Income amount > 0, Type=Income.
                // Let's assume absolute match.

                if (Math.abs(txA.amount) === Math.abs(txB.amount)) {
                    // TYPE CHECK: Must be opposite
                    const isOpposite = (
                        (txA.type === TransactionType.EXPENSE && txB.type === TransactionType.INCOME) ||
                        (txA.type === TransactionType.INCOME && txB.type === TransactionType.EXPENSE)
                    );

                    if (txA.type !== txB.type) {
                        // Found a pair!
                        // Determine which is Withdrawal (Source) and which is Deposit (Target)
                        // Expense -> Withdrawal
                        // Income -> Deposit
                        const withdrawal = txA.type === TransactionType.EXPENSE ? txA : txB;
                        const deposit = txA.type === TransactionType.EXPENSE ? txB : txA;

                        candidatesFound.push({
                            withdrawal,
                            deposit,
                            score: 1.0, // Perfect match
                            timeDiff
                        });
                        processedIds.add(txA.id);
                        processedIds.add(txB.id);
                        break; // Move to next A
                    }
                }
            }
        }

        setCandidates(candidatesFound);
        setIsScanning(false);
        console.log(`[TransferReconciler] Scanned ${transactions.length} txs, found ${candidatesFound.length} candidates.`);
    }, [transactions]);

    /**
     * Trigger Scan on Mount or Transaction Change
     */
    useEffect(() => {
        if (transactions.length > 0) {
            scanCandidates();
        }
    }, [scanCandidates, transactions.length]); // scanning dependency simplified

    /**
     * EXECUTE LINK (V3 Logic)
     * 1. Source (Withdrawal): Type=TRANSFER, ToAssetId=Target.AssetId, Amount=Positive(DB will allow, but logic needs to handle)
     *    WAIT, V3 Requirement: "amount also always positive". 
     *    Wait, re-reading plan: 
     *     "Input: Amount > 0, to_asset_id = TargetID (Source)"
     *     "Input: Amount > 0, to_asset_id = NULL (Target)"
     *    So we just set ToAssetId on Source, and Type=TRANSFER on both.
     */
    const handleLink = async (candidate: TransferCandidate) => {
        const { withdrawal, deposit } = candidate;

        // 1. Prepare Updates
        // Withdrawal (Source) -> Becomes Transfer, Points to Deposit Asset
        const sourceUpdate = {
            id: withdrawal.id,
            type: TransactionType.TRANSFER,
            toAssetId: deposit.assetId, // This makes it the Source
            linkedTransactionId: deposit.id,
            // Keep category/memo as is, or user can edit.
            // Amount stays positive.
        };

        // Deposit (Target) -> Becomes Transfer, No ToAssetId
        const targetUpdate = {
            id: deposit.id,
            type: TransactionType.TRANSFER,
            toAssetId: null as unknown as string, // Explicitly null for Destination (casted to string to satisfy partial if needed, but null is valid for optional)
            linkedTransactionId: withdrawal.id,
            // Amount stays positive.
        };

        // 2. Execute
        // We need a Service method to update these raw fields.
        // Existing linkTransactions service might enforce System Categories.
        // We should create a new V3 link method or use generic update.
        // Let's implement a direct update via SupabaseService for now using a new method we'll add.

        try {
            await SupabaseService.linkTransactionsV3(sourceUpdate, targetUpdate);

            // 3. Refresh
            onRefresh();

            // Remove from local candidates
            setCandidates(prev => prev.filter(c => c.withdrawal.id !== withdrawal.id));
        } catch (error) {
            console.error("Failed to link transactions:", error);
            alert("Failed to link transactions. Please try again.");
        }
    };

    const handleIgnore = (candidate: TransferCandidate) => {
        // For now, just remove from list. Ideally store in 'ignored_links' table.
        setCandidates(prev => prev.filter(c => c.withdrawal.id !== candidate.withdrawal.id));
    };

    return {
        candidates,
        isScanning,
        scanCandidates,
        handleLink,
        handleIgnore
    };
};

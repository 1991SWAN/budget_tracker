import { useMemo } from 'react';
import { Transaction, TransactionType, RecurringTransaction } from '../types';

export interface RegularCandidate {
    groupId: string;
    name: string; // The merchant or memo text
    averageAmount: number;
    occurrences: number;
    lastDate: string;
    nextEstimatedDate: string;
    transactionIds: string[]; // List of historical transaction IDs that make up this candidate
}

// Helper: Find the longest common substring between two strings
const findLongestCommonSubstring = (str1: string, str2: string): string => {
    if (!str1 || !str2) return '';
    const s1 = str1.toLowerCase().replace(/\s+/g, '');
    const s2 = str2.toLowerCase().replace(/\s+/g, '');
    let longest = '';

    for (let i = 0; i < s1.length; i++) {
        for (let j = i + 1; j <= s1.length; j++) {
            const sub = s1.slice(i, j);
            if (s2.includes(sub) && sub.length > longest.length) {
                longest = sub;
            }
        }
    }
    return longest;
};

export const detectRegularExpenses = (
    transactions: Transaction[],
    recurringBills: RecurringTransaction[]
) => {
    // 0. Filter transactions to last 120 days (Optimization User Request)
    const scanStartDate = new Date();
    scanStartDate.setDate(scanStartDate.getDate() - 120);
    const scanStartStr = scanStartDate.toISOString().split('T')[0];

    const recentTransactions = transactions.filter(tx => tx.date >= scanStartStr);

    // 1. Filter only Expenses
    const expenses = recentTransactions.filter(tx => tx.type === TransactionType.EXPENSE);

    // 2. Identify the merchant or clean memo (Similar to TransactionItem parser)
    const getCleanName = (tx: Transaction) => {
        const legacyMerchant = (tx as any).merchant;
        if (legacyMerchant) return legacyMerchant.toLowerCase().trim();

        const rawMemo = tx.memo || '';
        const mentionMatch = rawMemo.match(/@(\S+)/);
        if (mentionMatch) return mentionMatch[1].toLowerCase().trim();

        // If no merchant, try to use clean memo (without tags)
        const cleanMemo = rawMemo.replace(/#(\S+)/g, '').trim().toLowerCase();
        // If memo is too long or generic, we might skip it, but let's keep it simple for now
        return cleanMemo || tx.category.toLowerCase(); // Fallback to category if absolutely no text
    };

    // 3. Group by Name (PASS 1)
    const groupsByName = new Map<string, Transaction[]>();
    const unmappedExpenses: Transaction[] = []; // Collect transactions that don't confidently group by name

    expenses.forEach(tx => {
        const name = getCleanName(tx);
        if (!name) {
            unmappedExpenses.push(tx);
            return;
        }
        if (!groupsByName.has(name)) {
            groupsByName.set(name, []);
        }
        groupsByName.get(name)!.push(tx);
    });

    const candidates: RegularCandidate[] = [];
    const candidateTxIds = new Set<string>();

    // 4. Group by Exact Amount + Substring Match (PASS 2 - For those that didn't form a valid group in Pass 1)
    const groupsByAmount = new Map<number, Transaction[]>();

    // Move groups from Pass 1 with less than 2 items to unmapped for Pass 2 evaluation
    groupsByName.forEach((txList, name) => {
        if (txList.length < 2) {
            unmappedExpenses.push(...txList);
            groupsByName.delete(name);
        }
    });

    // Try to group the leftovers by exact amount
    unmappedExpenses.forEach(tx => {
        const amount = Math.abs(tx.amount); // Ensure positive for matching
        if (!groupsByAmount.has(amount)) {
            groupsByAmount.set(amount, []);
        }
        groupsByAmount.get(amount)!.push(tx);
    });

    // Consolidate groups to process
    const allGroupsToProcess: { name: string, list: Transaction[], method: 'name' | 'amount' }[] = [];

    groupsByName.forEach((list, name) => allGroupsToProcess.push({ name, list, method: 'name' }));
    groupsByAmount.forEach((list, amount) => allGroupsToProcess.push({ name: `AmountGroup_${amount}`, list, method: 'amount' }));

    // 5. Analyze each group for regularity
    allGroupsToProcess.forEach(({ list: txList, name, method }) => {
        if (txList.length < 2) return; // Need at least 2 to establish a pattern

        // Sort by date descending (newest first)
        txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        let isPatternFound = false;
        let validTxIds: string[] = [];
        let totalAmount = 0;

        // Simplistic Approach: Check the interval between the latest few
        // For a more robust algorithm, we'd check standard deviation of intervals
        for (let i = 0; i < txList.length - 1; i++) {
            const current = new Date(txList[i].date);
            const previous = new Date(txList[i + 1].date);

            // Difference in days
            const diffDays = Math.round(Math.abs(current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));

            // Check if interval is roughly a month (e.g. 26 to 35 days)
            if (diffDays >= 26 && diffDays <= 35) {

                // Amount similarity check (within 10% variance)
                // If method === 'name', check amount variance. If 'amount', amounts are already identical.
                let amountIsSimilar = true;
                if (method === 'name') {
                    const amt1 = Math.abs(txList[i].amount);
                    const amt2 = Math.abs(txList[i + 1].amount);

                    // Prevent division by zero if amount is 0 (though rare for bills)
                    if (amt1 === 0 && amt2 === 0) {
                        amountIsSimilar = true;
                    } else if (amt1 === 0 || amt2 === 0) {
                        amountIsSimilar = false;
                    } else {
                        // Calculate percentage difference relative to the larger amount
                        const maxAmt = Math.max(amt1, amt2);
                        const minAmt = Math.min(amt1, amt2);
                        const variance = (maxAmt - minAmt) / maxAmt;
                        amountIsSimilar = variance <= 0.10; // 10% variance allowed
                    }
                }

                if (amountIsSimilar) {
                    if (validTxIds.length === 0) {
                        validTxIds.push(txList[i].id);
                        totalAmount += txList[i].amount;
                    }
                    // Only add if not already added (can happen if chain continues)
                    if (validTxIds[validTxIds.length - 1] !== txList[i + 1].id) {
                        validTxIds.push(txList[i + 1].id);
                        totalAmount += txList[i + 1].amount;
                    }
                    isPatternFound = true;
                } else {
                    // Pattern breaks if amount varies too much
                    break;
                }
            } else {
                // If pattern breaks, we stop
                break;
            }
        }

        if (isPatternFound && validTxIds.length >= 2) {
            // If it's an amount group, we must verify the substring condition
            let finalGroupName = name; // Default to the group ID initially
            let validGroup = true;

            if (method === 'amount') {
                // Extract the actual transactions that formed the pattern
                const patternTxs = txList.filter(tx => validTxIds.includes(tx.id));

                // Check substring between consecutive items in the pattern
                let sharedSubstring = '';
                for (let i = 0; i < patternTxs.length - 1; i++) {
                    const memo1 = patternTxs[i].memo || patternTxs[i].merchant || '';
                    const memo2 = patternTxs[i + 1].memo || patternTxs[i + 1].merchant || '';

                    // Wait to assign sharedSubstring until we compare the first two
                    const currentLCS = findLongestCommonSubstring(memo1 as string, memo2 as string);

                    if (currentLCS.length < 2) { // Require at least 2 characters in common
                        validGroup = false;
                        break;
                    }

                    // Keep the smallest common denominator if there are >2 items, 
                    // though typically we just need *some* commonality between sequential payments.
                    if (sharedSubstring === '' || currentLCS.length < sharedSubstring.length) {
                        sharedSubstring = currentLCS;
                    }
                }

                if (!validGroup) return; // Discard this amount group if memos are totally unrelated

                // Determine a sensible name for the candidate. Use the most recent memo.
                const mostRecentTx = patternTxs[0];
                finalGroupName = (mostRecentTx.memo || mostRecentTx.merchant || 'Regular Payment').trim();
                // Capitalize first letter if it exists
                if (finalGroupName) finalGroupName = finalGroupName.charAt(0).toUpperCase() + finalGroupName.slice(1);
            }

            // Ensure not already in Recurring Bills (by name heuristic, or exact amount for pass 2)
            const alreadyExists = recurringBills.some(bill => {
                const nameMatches = bill.name.toLowerCase().trim() === finalGroupName.toLowerCase();
                const amountMatches = method === 'amount' && bill.amount === txList[0].amount;
                return nameMatches || amountMatches;
            });

            if (!alreadyExists) {
                const avgAmount = totalAmount / validTxIds.length;
                const lastDateObj = new Date(txList[0].date);
                const nextEstimated = new Date(lastDateObj);
                nextEstimated.setMonth(nextEstimated.getMonth() + 1);

                // Final stylistic cleanup for name method
                const displayGroupName = method === 'name'
                    ? finalGroupName.charAt(0).toUpperCase() + finalGroupName.slice(1)
                    : finalGroupName;

                candidates.push({
                    groupId: method === 'amount' ? `AmountMatch_${avgAmount}` : finalGroupName,
                    name: displayGroupName,
                    averageAmount: Math.round(avgAmount),
                    occurrences: validTxIds.length,
                    lastDate: txList[0].date,
                    nextEstimatedDate: nextEstimated.toISOString().split('T')[0],
                    transactionIds: validTxIds
                });

                validTxIds.forEach(id => candidateTxIds.add(id));
            }
        }
    });

    return {
        candidates: candidates.sort((a, b) => b.occurrences - a.occurrences), // Sort by confidence/frequency
        candidateTxIds
    };
};

export const useRegularExpenseDetector = (
    transactions: Transaction[],
    recurringBills: RecurringTransaction[]
) => {
    return useMemo(() => detectRegularExpenses(transactions, recurringBills), [transactions, recurringBills]);
};

import { useState, useEffect } from 'react';
import { TransactionService } from '../services/transactionService';

export const useGlobalRegularExpenseDetector = (
    user: any,
    recurringBills: RecurringTransaction[]
) => {
    const [result, setResult] = useState<{ candidates: RegularCandidate[], candidateTxIds: Set<string> }>({
        candidates: [],
        candidateTxIds: new Set()
    });

    useEffect(() => {
        if (!user) {
            setResult({ candidates: [], candidateTxIds: new Set() });
            return;
        }

        let isMounted = true;

        const runGlobalDetection = async () => {
            // Fetch up to 1000 transactions from the last 120 days
            const scanStartDate = new Date();
            scanStartDate.setDate(scanStartDate.getDate() - 120);
            const scanStartStr = scanStartDate.toISOString().split('T')[0];

            try {
                // Fetch independently of the UI state to ensure we have enough history
                const recentTxs = await TransactionService.getTransactions(1000, 0, {
                    dateRange: { start: scanStartStr, end: '2099-12-31' }
                });

                if (isMounted) {
                    setResult(detectRegularExpenses(recentTxs, recurringBills));
                }
            } catch (e) {
                console.error("Global automatic detection failed to fetch data:", e);
            }
        };

        runGlobalDetection();

        return () => { isMounted = false; };
    }, [user, recurringBills]);

    return result;
};

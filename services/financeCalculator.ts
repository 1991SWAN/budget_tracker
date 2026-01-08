import { Transaction, TransactionType, Asset, AssetType } from '../types';

export class FinanceCalculator {

    /**
     * Calculates the "Statement Balance" (Fixed Due Amount) and "Unbilled Balance" (Next Month)
     * based on the custom billing cycle.
     */
    static calculateCreditCardBalances(asset: Asset, transactions: Transaction[]): {
        statementBalance: number; // Previous cycle closed, due now
        unbilledBalance: number;  // Current usage, due next
        nextPaymentDate: string;
        billingPeriod: string;
    } {
        if (asset.type !== AssetType.CREDIT_CARD || !asset.creditDetails) {
            return { statementBalance: 0, unbilledBalance: 0, nextPaymentDate: '', billingPeriod: '' };
        }

        const { usageStartDay, paymentDay } = asset.creditDetails.billingCycle;
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

        // Determine "Current Statement Due" logic
        // 1. Find the most recent Payment Day. If today <= Payment Day, we are in the "Due" window.
        // 2. Identify the Usage Period for that Payment Day.

        // Example: Payment 25th. Usage 1st - End of Prev Month.
        // Today Jan 8th. Payment Jan 25th.
        // Usage Period: Dec 1st - Dec 31st.

        let targetPaymentDate = new Date(currentYear, currentMonth, paymentDay);
        // If today is PAST the payment day (e.g. Jan 26th), the "Next Payment" is Feb 25th.
        if (today.getDate() > paymentDay) {
            targetPaymentDate.setMonth(currentMonth + 1);
        }

        // Now backtrack to find the Usage Period for this Target Payment Date.
        // Logic depends on "Month gap" between usage and payment.
        // Usually: Usage (M-1) -> Pay (M) or Usage (M) -> Pay (M+1).
        // Let's assume standard: Payment is in Month M. Usage ended ~14-25 days before payment.

        // Approximation: Usage End is roughly 14 days before Payment? 
        // Or strictly defined by start day?
        // If Usage Start is 1, Usage End is previous month end.
        // If Usage Start is 14, Usage End is 13th of current month (if paying 25th?? No, 14-13 usually pays next month).

        // Let's deduce Usage End Date based on Start Date relative to Payment Date.
        // Standard Korean Cycles:
        // Period: Prev Month 1st - Prev Month End => Pay: Current 14th/25th
        // Period: Prev Month 14th - Current Month 13th => Pay: Current 25th? Or Next 1st?

        // Algorithm:
        // 1. Calculate the 'Usage End Date' that corresponds to the 'Target Payment Date'.
        //    (Usage End is generally 12~45 days before Payment).
        //    If UsageStart < PaymentDay (e.g. Usage 1st, Pay 25th), it's likely previous month usage.
        //    If UsageStart > PaymentDay (e.g. Usage 14th, Pay 1st), it's likely (M-2) to (M-1).

        // Simplified Logic for MVP: 
        // Usage End Date is the day BEFORE User's Usage Start Day.
        // Find the most recent "Usage End Date" before the "Target Payment Date" but with enough gap (min 10 days).

        let usageEndDate = new Date(targetPaymentDate);
        usageEndDate.setDate(usageStartDay - 1); // e.g. Start 14 -> End 13.

        // If Usage End > Payment (impossible), go back a month.
        if (usageEndDate >= targetPaymentDate) {
            usageEndDate.setMonth(usageEndDate.getMonth() - 1);
        }

        // Ensure gap. If Usage End is dangerously close (e.g. 1 day), it might be previous month.
        // Let's assume the Bill closes at least 10 days before payment.
        const gap = (targetPaymentDate.getTime() - usageEndDate.getTime()) / (1000 * 3600 * 24);
        if (gap < 10) {
            usageEndDate.setMonth(usageEndDate.getMonth() - 1);
        }

        let usageStartDate = new Date(usageEndDate);
        if (usageStartDay > usageEndDate.getDate()) {
            // e.g. End 13th. Start 14th. So Start is previous month.
            usageStartDate.setMonth(usageStartDate.getMonth() - 1);
        }
        usageStartDate.setDate(usageStartDay);

        // Reset Time
        usageStartDate.setHours(0, 0, 0, 0);
        usageEndDate.setHours(23, 59, 59, 999);

        // Calculate Statement Balance (Transactions within Usage Period)
        const relevantTxs = transactions.filter(t => t.assetId === asset.id);
        const statementTxs = relevantTxs.filter(t => {
            const d = new Date(t.date);
            return d >= usageStartDate && d <= usageEndDate;
        });

        // Waterfall Logic:

        // Unbilled Balance: Everything AFTER Usage End Date
        const unbilledTxs = relevantTxs.filter(t => {
            const d = new Date(t.date);
            return d > usageEndDate;
        });

        // 1. Calculate Gross Expenses for Statement Period
        const grossStatementBalance = statementTxs
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);

        // 2. Calculate Gross Expenses for Unbilled Period
        const grossUnbilledBalance = unbilledTxs
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);

        // 3. Calculate TOTAL Payments/Refunds (All Time for this asset)
        // We look at ALL transactions for this asset to find influx of cash (Payment)
        const totalPayments = relevantTxs
            .filter(t => t.type === TransactionType.INCOME || (t.type === TransactionType.TRANSFER && t.toAssetId === asset.id))
            .reduce((sum, t) => sum + t.amount, 0);

        // --- Handle Initial Balance (Migration/Setup) ---
        // 'asset.balance' is the current real-time balance.
        // We need to back-calculate the 'Initial Balance' to see if there was starting debt.
        // Current Balance = Initial + Expenses(-ve) + Income(+ve)
        // For Credit Cards, Expenses are -ve in asset.balance but +ve in our 'gross' calc.
        // Let's rely on standard ledger:
        // Initial = Current - (Sum of Txs)
        const netTxChange = relevantTxs.reduce((acc, t) => {
            if (t.type === TransactionType.INCOME || (t.type === TransactionType.TRANSFER && t.toAssetId === asset.id)) return acc + t.amount;
            if (t.type === TransactionType.EXPENSE || (t.type === TransactionType.TRANSFER && t.assetId === asset.id)) return acc - t.amount;
            return acc;
        }, 0);

        const initialBalance = asset.balance - netTxChange;
        const initialDebt = initialBalance < 0 ? Math.abs(initialBalance) : 0;

        // 4. Apply Payments to Statement First
        // The Statement Balance matches the "Gross" + "Initial Debt" unless paid off.
        const statementBalance = Math.max(0, (grossStatementBalance + initialDebt) - totalPayments);

        // 5. Apply Remaining Payments to Unbilled
        // Amount used for statement:
        const paymentUsedForStatement = grossStatementBalance - statementBalance;
        const remainingPayment = totalPayments - paymentUsedForStatement;

        const unbilledBalance = Math.max(0, grossUnbilledBalance - remainingPayment);

        return {
            statementBalance: Math.max(0, statementBalance), // Don't show negative due
            unbilledBalance: Math.max(0, unbilledBalance),
            nextPaymentDate: targetPaymentDate.toISOString().split('T')[0],
            billingPeriod: `${usageStartDate.getMonth() + 1}/${usageStartDate.getDate()} ~ ${usageEndDate.getMonth() + 1}/${usageEndDate.getDate()}`
        };
    }

    /**
     * Calculates Loan Amortization Schedule
     */
    static calculateLoanSchedule(principal: number, annualRate: number, months: number): {
        monthlyPayment: number;
        totalInterest: number;
        schedule: { month: number, payment: number, principal: number, interest: number, balance: number }[]
    } {
        if (annualRate === 0) {
            const monthly = principal / months;
            const schedule = Array.from({ length: months }, (_, i) => ({
                month: i + 1, payment: monthly, principal: monthly, interest: 0, balance: principal - (monthly * (i + 1))
            }));
            return { monthlyPayment: monthly, totalInterest: 0, schedule };
        }

        const r = annualRate / 100 / 12;
        const n = months;
        // Formula: M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1 ]
        const monthlyPayment = principal * ((r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));

        let balance = principal;
        let totalInterest = 0;
        const schedule = [];

        for (let i = 1; i <= n; i++) {
            const interest = balance * r;
            const principalPayment = monthlyPayment - interest;
            balance -= principalPayment;
            if (balance < 0) balance = 0; // Floating point fix
            totalInterest += interest;
            schedule.push({
                month: i,
                payment: monthlyPayment,
                principal: principalPayment,
                interest: interest,
                balance: balance
            });
        }

        return { monthlyPayment, totalInterest, schedule };
    }
}

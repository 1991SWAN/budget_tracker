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

        // Calculate Usage Period (Existing Logic)
        let usageEndDate = new Date(targetPaymentDate);
        usageEndDate.setDate(usageStartDay - 1);
        if (usageEndDate >= targetPaymentDate) {
            usageEndDate.setMonth(usageEndDate.getMonth() - 1);
        }
        const gap = (targetPaymentDate.getTime() - usageEndDate.getTime()) / (1000 * 3600 * 24);
        if (gap < 10) {
            usageEndDate.setMonth(usageEndDate.getMonth() - 1);
        }
        let usageStartDate = new Date(usageEndDate);
        if (usageStartDay > usageEndDate.getDate()) {
            usageStartDate.setMonth(usageStartDate.getMonth() - 1);
        }
        usageStartDate.setDate(usageStartDay);
        usageStartDate.setHours(0, 0, 0, 0);
        usageEndDate.setHours(23, 59, 59, 999);

        // Core Refactor: Statement Balance = Total Debt - Future Liability
        // This ensures proper installment handling (only billing the current portion).

        // 1. Determine Total Debt (Real-time from Asset Balance)
        // usage: Balance is negative for debt.
        const totalDebt = asset.balance < 0 ? Math.abs(asset.balance) : 0;

        // 2. Calculate Future Liability (Expenses that are NOT yet due in this statement)
        const relevantTxs = transactions.filter(t => t.assetId === asset.id);

        let futureLiability = 0;

        relevantTxs.filter(t => t.type === TransactionType.EXPENSE || (t.type === TransactionType.TRANSFER && t.assetId === asset.id)).forEach(tx => {
            const txDate = new Date(tx.date);

            if (tx.installment && tx.installment.totalMonths > 1) {
                // Installment Logic: Sum only portions falling AFTER usageEndDate
                const monthlyAmount = tx.amount / tx.installment.totalMonths;

                for (let i = 0; i < tx.installment.totalMonths; i++) {
                    const portionDueDate = new Date(txDate);
                    portionDueDate.setMonth(portionDueDate.getMonth() + i);

                    // If this portion belongs to a future cycle (after current usageEndDate)
                    if (portionDueDate > usageEndDate) {
                        futureLiability += monthlyAmount;
                    }
                }
            } else {
                // Regular Logic: If transaction date is AFTER usageEndDate
                if (txDate > usageEndDate) {
                    futureLiability += tx.amount;
                }
            }
        });

        // 3. Statement Balance (Due Now)
        // If we owe 1200 Total, and 1100 is Future, then 100 is Due Now.
        // If we paid 50 (Total 1150), and 1100 is Future, then 50 is Due Now.
        const statementBalance = Math.max(0, totalDebt - futureLiability);

        // 4. Unbilled Balance
        // Represents all debt that is not yet on the current statement.
        // This includes Next Month's portion + All subsequent portions.
        const unbilledBalance = futureLiability;

        return {
            statementBalance: Math.max(0, statementBalance),
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

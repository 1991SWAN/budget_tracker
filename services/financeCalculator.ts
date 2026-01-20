import { Transaction, TransactionType, Asset, AssetType } from '../types';

export class FinanceCalculator {

    /**
     * Calculates the "Statement Balance" (Past Accumulated Debt) and "Unbilled Balance" (Current Spending)
     * based on the custom billing cycle.
     */
    static calculateCreditCardBalances(asset: Asset, transactions: Transaction[]): {
        pastDue: number;      // Billed but unpaid from past cycles
        nextBill: number;     // Spending in the current billing cycle
        unbilled: number;     // Future installments/expenses
        nextPaymentDate: string;
        billingPeriod: string;
        usageStartDate: Date;
        usageEndDate: Date;
    } {
        if (asset.type !== AssetType.CREDIT_CARD || !asset.creditDetails) {
            return { pastDue: 0, nextBill: 0, unbilled: 0, nextPaymentDate: '', billingPeriod: '', usageStartDate: new Date(), usageEndDate: new Date() };
        }

        const { usageStartDay, paymentDay } = asset.creditDetails.billingCycle;
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

        let targetPaymentDate = new Date(currentYear, currentMonth, paymentDay);
        if (today.getDate() > paymentDay) {
            targetPaymentDate.setMonth(currentMonth + 1);
        }

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

        // Calculate Totals
        const totalDebt = asset.balance < 0 ? Math.abs(asset.balance) : 0;
        const relevantTxs = transactions.filter(t => t.assetId === asset.id);

        let nextBill = 0;
        let futureUnbilled = 0;

        relevantTxs.forEach(tx => {
            const txDate = new Date(tx.date);
            if (tx.installment && tx.installment.totalMonths > 1) {
                const totalPrincipal = tx.amount;
                const months = tx.installment.totalMonths;
                const monthlyPrincipal = Math.floor(totalPrincipal / months);
                const firstMonthAdjustment = totalPrincipal - (monthlyPrincipal * months);
                const isInterestFree = tx.installment.isInterestFree;
                const apr = asset.creditDetails?.apr || 0;
                const monthlyRate = apr / 100 / 12;

                for (let i = 0; i < months; i++) {
                    const portionDate = new Date(txDate);
                    portionDate.setMonth(portionDate.getMonth() + i);

                    let principalPortion = monthlyPrincipal;
                    if (i === 0) principalPortion += firstMonthAdjustment;

                    let interestPortion = 0;
                    if (!isInterestFree && apr > 0) {
                        const remainingPrincipal = totalPrincipal - (monthlyPrincipal * i);
                        interestPortion = remainingPrincipal * monthlyRate;
                    }

                    const totalMonthlyAmount = principalPortion + interestPortion;

                    if (portionDate >= usageStartDate && portionDate <= usageEndDate) {
                        nextBill += totalMonthlyAmount;
                    } else if (portionDate > usageEndDate) {
                        futureUnbilled += totalMonthlyAmount;
                    }
                }
            } else {
                if (txDate >= usageStartDate && txDate <= usageEndDate) {
                    nextBill += tx.amount;
                } else if (txDate > usageEndDate) {
                    futureUnbilled += tx.amount;
                }
            }
        });

        const pastDue = Math.max(0, totalDebt - nextBill - futureUnbilled);

        return {
            pastDue: Math.round(pastDue),
            nextBill: Math.round(nextBill),
            unbilled: Math.round(futureUnbilled),
            nextPaymentDate: targetPaymentDate.toISOString().split('T')[0],
            billingPeriod: `${usageStartDate.getMonth() + 1}/${usageStartDate.getDate()} ~ ${usageEndDate.getMonth() + 1}/${usageEndDate.getDate()}`,
            usageStartDate,
            usageEndDate
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

import { RecurringTransaction, Transaction, TransactionType } from '../types';

export type BillStatus = 'PAID' | 'OVERDUE' | 'UPCOMING' | 'LATE';

export class SubscriptionCalculator {

    /**
     * Determines the status of a recurring bill for a specific month.
     * 
     * @param bill The recurring transaction definition
     * @param month Date object representing the target month
     * @param transactions List of actual transactions to check against (for auto-match future V2)
     * @returns BillStatus
     */
    static getBillStatus(bill: RecurringTransaction, month: Date, transactions: Transaction[] = []): BillStatus {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        const targetYear = month.getFullYear();
        const targetMonth = month.getMonth();

        // Due date for this specific month
        const dueDate = new Date(targetYear, targetMonth, bill.dayOfMonth);

        // Future months are always upcoming
        if (targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth)) {
            return 'UPCOMING';
        }

        // Logic for "Paid" - keeping it simple for V1 as requested (Manual Checkbox state to be handled in Component)
        // For this calculator, we mainly care about Date vs Today for Overdue/Upcoming

        // If we are looking at past months or today is past due date
        const isPastDue = today.getTime() > dueDate.getTime() + (24 * 60 * 60 * 1000); // 1 day grace

        if (isPastDue) {
            // In a real implementation, we would check if it was marked paid. 
            // Since "Paid" state is UI-driven in V1 (stored likely in local state or a tracking table), 
            // this calculator assumes "Unpaid" unless externally told.
            // But strictly based on date:
            return 'OVERDUE';
        }

        return 'UPCOMING';
    }

    /**
     * Calculates the total fixed expenses for a given list of recurring transactions.
     * Handles different bill types if necessary.
     */
    static calculateTotalMonthlyFixed(recurring: RecurringTransaction[]): number {
        return recurring.reduce((sum, item) => sum + item.amount, 0);
    }

    /**
     * Sorts bills by day of month
     */
    static sortByDueDate(recurring: RecurringTransaction[]): RecurringTransaction[] {
        return [...recurring].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
    }
}

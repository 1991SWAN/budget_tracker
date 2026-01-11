import * as XLSX from 'xlsx';
import { Transaction, Asset, RecurringTransaction, SavingsGoal } from '../types';

export class ExportService {
    /**
     * Exports all application data to a single Excel file with multiple sheets.
     */
    static exportData(
        transactions: Transaction[],
        assets: Asset[],
        recurring: RecurringTransaction[],
        goals: SavingsGoal[]
    ) {
        const workbook = XLSX.utils.book_new();

        // 1. Transactions Sheet
        // Transform data for better readability if needed (e.g. formatting dates or enums)
        const txData = transactions.map(t => ({
            ID: t.id,
            Date: t.date,
            Amount: t.amount,
            Type: t.type,
            Category: t.category,
            Memo: t.memo,
            AssetID: t.assetId,
            ToAssetID: t.toAssetId || '',
            Emoji: t.emoji || ''
        }));
        const txSheet = XLSX.utils.json_to_sheet(txData);
        XLSX.utils.book_append_sheet(workbook, txSheet, 'Transactions');

        // 2. Assets Sheet
        const assetData = assets.map(a => ({
            ID: a.id,
            Name: a.name,
            Type: a.type,
            Balance: a.balance,
            Currency: a.currency,
            Color: a.color
        }));
        const assetSheet = XLSX.utils.json_to_sheet(assetData);
        XLSX.utils.book_append_sheet(workbook, assetSheet, 'Assets');

        // 3. Recurring Bills Sheet
        const recurringData = recurring.map(r => ({
            ID: r.id,
            Name: r.name,
            Amount: r.amount,
            Day: r.dayOfMonth,
            Category: r.category,
            Type: r.billType,
            Group: r.groupName || ''
        }));
        const recurringSheet = XLSX.utils.json_to_sheet(recurringData);
        XLSX.utils.book_append_sheet(workbook, recurringSheet, 'Recurring');

        // 4. Goals Sheet
        const goalData = goals.map(g => ({
            ID: g.id,
            Name: g.name,
            Target: g.targetAmount,
            Current: g.currentAmount,
            Deadline: g.deadline || '',
            Emoji: g.emoji || ''
        }));
        const goalSheet = XLSX.utils.json_to_sheet(goalData);
        XLSX.utils.book_append_sheet(workbook, goalSheet, 'Goals');

        // Generate filename with timestamp
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `SmartPenny_Backup_${dateStr}.xlsx`;

        // Trigger Download
        XLSX.writeFile(workbook, fileName);
    }
}

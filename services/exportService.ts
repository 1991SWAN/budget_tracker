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
        goals: SavingsGoal[],
        categories: any[] = [] // Added categories for lookup
    ) {
        const workbook = XLSX.utils.book_new();

        // --- Helper: Asset Name Resolver ---
        const getAssetName = (id: string) => {
            const asset = assets.find(a => a.id === id);
            if (!asset) return 'Unknown Asset';
            // User requested: Institution + Name
            return asset.institution ? `${asset.institution} ${asset.name}` : asset.name;
        };

        // --- Helper: Category Name Resolver ---
        const getCategoryName = (id: string) => {
            // Try to find by ID first
            const cat = categories.find(c => c.id === id);
            if (cat) return cat.name;
            // Fallback: If ID is actually a legacy name or enum
            return id === 'Other' ? 'Other' : id;
        };

        // --- Helper: Memo Parser (@Merchant #Tag) ---
        const parseMemo = (memo: string) => {
            let cleanMemo = memo || '';
            let merchant = '';
            const tags: string[] = [];

            // 1. Extract Tags (#)
            const tagMatches = cleanMemo.match(/#(\S+)/g);
            if (tagMatches) {
                tagMatches.forEach(tag => {
                    tags.push(tag);
                    cleanMemo = cleanMemo.replace(tag, '');
                });
            }

            // 2. Extract Merchant (@)
            const mentionMatch = cleanMemo.match(/@(\S+)/);
            if (mentionMatch) {
                merchant = mentionMatch[1];
                cleanMemo = cleanMemo.replace(mentionMatch[0], '');
            }

            return {
                content: cleanMemo.trim(),
                merchant,
                tags: tags.join(' ')
            };
        };

        // 1. Transactions Sheet (Enhanced)
        const txData = transactions.map(t => {
            const { content, merchant, tags } = parseMemo(t.memo);
            const parsedDate = new Date(t.date);
            const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '';

            // Installment Formatter
            let installmentStr = '';
            if (t.installment && t.installment.totalMonths > 1) {
                installmentStr = `${t.installment.totalMonths} mos`;
                if (t.installment.currentMonth) installmentStr += ` (${t.installment.currentMonth}/${t.installment.totalMonths})`;
            }

            return {
                Date: t.date,
                Time: timeStr,
                Asset: getAssetName(t.assetId),
                Type: t.type === 'INCOME' ? 'Income' : t.type === 'EXPENSE' ? 'Expense' : 'Transfer',
                Amount: t.amount,
                Category: getCategoryName(t.category),
                Description: content || (merchant ? '' : 'No description'), // If merchant exists, main content might be empty
                Merchant: t.merchant || merchant, // Database col OR Parsed
                Installment: installmentStr,
                Tags: tags,
                // Hidden/Technical Columns (Optional, maybe at the end)
                _AssetID: t.assetId,
                _OriginalMemo: t.memo
            };
        });

        const txSheet = XLSX.utils.json_to_sheet(txData);

        // Auto-width for columns (Basic heuristic)
        const wscols = [
            { wch: 12 }, // Date
            { wch: 8 },  // Time
            { wch: 20 }, // Asset
            { wch: 8 },  // Type
            { wch: 12 }, // Amount
            { wch: 15 }, // Category
            { wch: 30 }, // Content
            { wch: 20 }, // Merchant
            { wch: 15 }, // Installment
            { wch: 20 }, // Tags
        ];
        txSheet['!cols'] = wscols;

        XLSX.utils.book_append_sheet(workbook, txSheet, 'Transactions');

        // 2. Assets Sheet
        const assetData = assets.map(a => ({
            'Asset Name': a.name,
            Institution: a.institution || '',
            Type: a.type,
            Balance: a.balance,
            Currency: a.currency,
            'Account Number': a.accountNumber || ''
        }));
        const assetSheet = XLSX.utils.json_to_sheet(assetData);
        assetSheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 8 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, assetSheet, 'Asset Status');

        // 3. Recurring Bills Sheet
        const recurringData = recurring.map(r => ({
            Name: r.name,
            Amount: r.amount,
            'Payment Day': `Every ${r.dayOfMonth}th`,
            Category: getCategoryName(r.category), // Use helper here too
            Type: r.billType
        }));
        const recurringSheet = XLSX.utils.json_to_sheet(recurringData);
        XLSX.utils.book_append_sheet(workbook, recurringSheet, 'Recurring Bills');

        // 4. Goals Sheet
        const goalData = goals.map(g => ({
            'Goal Name': g.name,
            'Target Amount': g.targetAmount,
            'Current Amount': g.currentAmount,
            Progress: g.targetAmount > 0 ? `${((g.currentAmount / g.targetAmount) * 100).toFixed(1)}%` : '0%',
            Deadline: g.deadline || ''
        }));
        const goalSheet = XLSX.utils.json_to_sheet(goalData);
        XLSX.utils.book_append_sheet(workbook, goalSheet, 'Savings Goals');

        // Generate filename with timestamp
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `SmartPenny_Export_${dateStr}.xlsx`;

        // Trigger Download
        XLSX.writeFile(workbook, fileName);
    }
}

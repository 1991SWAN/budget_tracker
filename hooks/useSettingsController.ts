import { useCallback } from 'react';
import { AssetService } from '../services/assetService';
import { CategoryService } from '../services/categoryService';
import { DataService } from '../services/dataService';
import { ExportService } from '../services/exportService';
import { GoalService } from '../services/goalService';
import { RecurringService } from '../services/recurringService';
import { TransactionService } from '../services/transactionService';
import { useToast } from '../contexts/ToastContext';

export const useSettingsController = () => {
    const { addToast } = useToast();

    const handleExport = useCallback(async () => {
        try {
            const [txs, assets, recurring, goals, categories] = await Promise.all([
                TransactionService.getTransactions(),
                AssetService.getAssets(),
                RecurringService.getRecurring(),
                GoalService.getGoals(),
                CategoryService.getCategories()
            ]);
            await ExportService.exportData(txs, assets, recurring, goals, categories);
        } catch (error) {
            console.error('Export failed', error);
            addToast('Failed to export data.', 'error');
        }
    }, [addToast]);

    const handleResetConfirm = useCallback(async (options: any) => {
        await DataService.resetData(options);
        window.location.reload();
    }, []);

    return {
        handleExport,
        handleResetConfirm,
    };
};

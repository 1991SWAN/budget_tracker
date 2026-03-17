import { useCallback } from 'react';
import { SupabaseService } from '../services/supabaseService';
import { ExportService } from '../services/exportService';
import { useToast } from '../contexts/ToastContext';

export const useSettingsController = () => {
    const { addToast } = useToast();

    const handleExport = useCallback(async () => {
        try {
            const [txs, assets, recurring, goals, categories] = await Promise.all([
                SupabaseService.getTransactions(),
                SupabaseService.getAssets(),
                SupabaseService.getRecurring(),
                SupabaseService.getGoals(),
                SupabaseService.getCategories()
            ]);
            await ExportService.exportData(txs, assets, recurring, goals, categories);
        } catch (error) {
            console.error('Export failed', error);
            addToast('Failed to export data.', 'error');
        }
    }, [addToast]);

    const handleResetConfirm = useCallback(async (options: any) => {
        await SupabaseService.resetData(options);
        window.location.reload();
    }, []);

    return {
        handleExport,
        handleResetConfirm,
    };
};

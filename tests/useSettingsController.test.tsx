import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsController } from '../hooks/useSettingsController';

const mocks = vi.hoisted(() => ({
    addToast: vi.fn(),
    getTransactions: vi.fn(),
    getAssets: vi.fn(),
    getRecurring: vi.fn(),
    getGoals: vi.fn(),
    getCategories: vi.fn(),
    exportData: vi.fn(),
    resetData: vi.fn(),
}));

vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../services/transactionService', () => ({
    TransactionService: {
        getTransactions: mocks.getTransactions,
    },
}));

vi.mock('../services/assetService', () => ({
    AssetService: {
        getAssets: mocks.getAssets,
    },
}));

vi.mock('../services/recurringService', () => ({
    RecurringService: {
        getRecurring: mocks.getRecurring,
    },
}));

vi.mock('../services/goalService', () => ({
    GoalService: {
        getGoals: mocks.getGoals,
    },
}));

vi.mock('../services/categoryService', () => ({
    CategoryService: {
        getCategories: mocks.getCategories,
    },
}));

vi.mock('../services/exportService', () => ({
    ExportService: {
        exportData: mocks.exportData,
    },
}));

vi.mock('../services/dataService', () => ({
    DataService: {
        resetData: mocks.resetData,
    },
}));

describe('useSettingsController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getTransactions.mockResolvedValue([{ id: 'tx-1' }]);
        mocks.getAssets.mockResolvedValue([{ id: 'asset-1' }]);
        mocks.getRecurring.mockResolvedValue([{ id: 'rec-1' }]);
        mocks.getGoals.mockResolvedValue([{ id: 'goal-1' }]);
        mocks.getCategories.mockResolvedValue([{ id: 'cat-1' }]);
        mocks.exportData.mockResolvedValue(undefined);
        mocks.resetData.mockResolvedValue(undefined);
    });

    it('loads all domain data and forwards it to the export service', async () => {
        const { result } = renderHook(() => useSettingsController());

        await act(async () => {
            await result.current.handleExport();
        });

        expect(mocks.exportData).toHaveBeenCalledWith(
            [{ id: 'tx-1' }],
            [{ id: 'asset-1' }],
            [{ id: 'rec-1' }],
            [{ id: 'goal-1' }],
            [{ id: 'cat-1' }],
        );
    });

    it('shows a toast when export fails', async () => {
        mocks.getTransactions.mockRejectedValue(new Error('boom'));
        const { result } = renderHook(() => useSettingsController());

        await act(async () => {
            await result.current.handleExport();
        });

        expect(mocks.addToast).toHaveBeenCalledWith('Failed to export data.', 'error');
        expect(mocks.exportData).not.toHaveBeenCalled();
    });
});

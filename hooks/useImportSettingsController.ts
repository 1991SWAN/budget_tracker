import { useCallback, useEffect, useState } from 'react';
import { ImportPreset, ImportService } from '../services/importService';
import { SupabaseService } from '../services/supabaseService';
import { Asset } from '../types';

export const useImportSettingsController = () => {
    const [presets, setPresets] = useState<ImportPreset[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);

    const loadData = useCallback(async () => {
        setPresets(ImportService.getPresets());
        const assetList = await SupabaseService.getAssets();
        setAssets(assetList);
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleDelete = useCallback((id: string) => {
        if (window.confirm('Are you sure you want to delete this preset?')) {
            ImportService.deletePreset(id);
            setPresets(ImportService.getPresets());
        }
    }, []);

    const handleUnlink = useCallback((id: string) => {
        if (window.confirm('Unlink this preset from the specific account? It will become a generic preset.')) {
            ImportService.unlinkPreset(id);
            setPresets(ImportService.getPresets());
        }
    }, []);

    return {
        presets,
        assets,
        handleDelete,
        handleUnlink,
    };
};

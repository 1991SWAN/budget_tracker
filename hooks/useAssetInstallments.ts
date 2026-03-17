import { useEffect, useState } from 'react';
import { Asset, AssetType, Transaction } from '../types';
import { SupabaseService } from '../services/supabaseService';

export const useAssetInstallments = (asset: Asset, activeTab: 'overview' | 'simulation' | 'installments') => {
    const [allInstallments, setAllInstallments] = useState<Transaction[]>([]);
    const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);

    useEffect(() => {
        let mounted = true;

        if (activeTab !== 'installments' || asset.type !== AssetType.CREDIT_CARD) {
            return;
        }

        const loadInstallments = async () => {
            setIsLoadingInstallments(true);
            try {
                const data = await SupabaseService.getInstallmentsByAsset(asset.id);
                if (mounted) {
                    setAllInstallments(data);
                }
            } finally {
                if (mounted) {
                    setIsLoadingInstallments(false);
                }
            }
        };

        void loadInstallments();
        return () => {
            mounted = false;
        };
    }, [activeTab, asset.id, asset.type]);

    return {
        allInstallments,
        isLoadingInstallments,
    };
};

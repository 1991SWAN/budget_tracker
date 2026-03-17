import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AssetService } from '../services/assetService';
import { TransactionService } from '../services/transactionService';
import { Asset, AssetType, CategoryId, Transaction, TransactionType } from '../types';
import type { ModalFormSetter, ModalSelectedItemSetter, ModalTypeSetter } from './modalTypes';

interface UseAssetControllerOptions {
    assets: Asset[];
    setAssets: Dispatch<SetStateAction<Asset[]>>;
    setTransactions: Dispatch<SetStateAction<Transaction[]>>;
    addTransaction: (transaction: Transaction) => Promise<void>;
    addToast: (message: string, type?: string) => void;
    defaultExpenseCategoryId: CategoryId;
    defaultIncomeCategoryId: CategoryId;
    cardPaymentCategoryId: CategoryId;
    setSelectedItem: ModalSelectedItemSetter;
    setFormData: ModalFormSetter;
    setPaymentAsset: (assetId: string) => void;
    setPaymentError: (message: string | null) => void;
    setModalType: ModalTypeSetter;
}

export const useAssetController = ({
    assets,
    setAssets,
    setTransactions,
    addTransaction,
    addToast,
    defaultExpenseCategoryId,
    defaultIncomeCategoryId,
    cardPaymentCategoryId,
    setSelectedItem,
    setFormData,
    setPaymentAsset,
    setPaymentError,
    setModalType,
}: UseAssetControllerOptions) => {
    const handleAssetAdd = useCallback(async (asset: Asset) => {
        await AssetService.saveAsset(asset);
        await AssetService.saveOpeningBalance({ asset_id: asset.id, amount: asset.initialBalance });
        setAssets(previous => [...previous, asset]);
    }, [setAssets]);

    const handleAssetDelete = useCallback(async (assetId: string) => {
        await AssetService.deleteAsset(assetId);
        setAssets(previous => previous.filter(asset => asset.id !== assetId));
    }, [setAssets]);

    const handleAssetEdit = useCallback(async (editedAsset: Asset) => {
        const previousAsset = assets.find(asset => asset.id === editedAsset.id);
        if (!previousAsset) return;

        const mode = (editedAsset as any)._adjustmentMode;
        const diff = editedAsset.balance - previousAsset.balance;

        if (mode === 'SETTING') {
            const correctedAsset = { ...editedAsset };
            delete (correctedAsset as any)._adjustmentMode;
            await AssetService.saveAsset(correctedAsset);
            await AssetService.saveOpeningBalance({ asset_id: correctedAsset.id, amount: correctedAsset.initialBalance });
            setAssets(previous => previous.map(asset => (
                asset.id === correctedAsset.id ? correctedAsset : asset
            )));
            return;
        }

        const metadataOnly = { ...editedAsset, balance: previousAsset.balance };
        delete (metadataOnly as any)._adjustmentMode;
        await AssetService.saveAsset(metadataOnly);
        setAssets(previous => previous.map(asset => (
            asset.id === metadataOnly.id ? metadataOnly : asset
        )));

        if (diff === 0) return;

        await addTransaction({
            id: `adj-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            amount: Math.abs(diff),
            type: diff > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
            category: diff > 0 ? defaultIncomeCategoryId : defaultExpenseCategoryId,
            memo: 'Manual Balance Adjustment',
            assetId: editedAsset.id,
        });
    }, [addTransaction, assets, defaultExpenseCategoryId, defaultIncomeCategoryId, setAssets]);

    const handleClearAssetHistory = useCallback(async (assetId: string) => {
        try {
            await TransactionService.deleteTransactionsByAsset(assetId);
            setTransactions(previous => previous.filter(transaction => (
                transaction.assetId !== assetId && transaction.toAssetId !== assetId
            )));

            const targetAsset = assets.find(asset => asset.id === assetId);
            setAssets(previous => previous.map(asset => (
                asset.id === assetId ? { ...asset, balance: targetAsset?.initialBalance || 0 } : asset
            )));

            addToast('History cleared and balance reset to 0.', 'success');
        } catch (error) {
            console.error('Failed to clear history', error);
            addToast('Failed to clear history. Please try again.', 'error');
        }
    }, [addToast, assets, setAssets, setTransactions]);

    const openAssetPay = useCallback((asset: Asset) => {
        setSelectedItem(asset);
        setFormData({
            amount: Math.abs(asset.balance),
            date: new Date().toISOString().split('T')[0],
            memo: `Credit Card Payoff: ${asset.name}`,
            category: cardPaymentCategoryId
        });
        setPaymentAsset(assets.find(item => item.type !== AssetType.CREDIT_CARD)?.id || '');
        setPaymentError(null);
        setModalType('pay-card');
    }, [assets, cardPaymentCategoryId, setFormData, setModalType, setPaymentAsset, setPaymentError, setSelectedItem]);

    return {
        handleAssetAdd,
        handleAssetDelete,
        handleAssetEdit,
        handleClearAssetHistory,
        openAssetPay,
    };
};

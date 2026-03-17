import React from 'react';
import AssetManager from '../AssetManager';
import { Asset, Transaction } from '../../types';

interface AssetsScreenProps {
    assets: Asset[];
    transactions: Transaction[];
    onAdd: (asset: Asset) => Promise<void>;
    onEdit: (asset: Asset) => Promise<void>;
    onDelete: (assetId: string) => Promise<void>;
    onPay?: (asset: Asset) => void;
    onClearHistory?: (assetId: string) => Promise<void>;
}

export const AssetsScreen: React.FC<AssetsScreenProps> = (props) => {
    return <AssetManager {...props} />;
};

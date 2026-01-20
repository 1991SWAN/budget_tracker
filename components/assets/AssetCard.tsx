import React, { useMemo } from 'react';
import { Asset, AssetType, Transaction } from '../../types';
import { FinanceCalculator } from '../../services/financeCalculator';
import { ASSET_THEMES } from './constants';

interface AssetCardProps {
    asset: Asset;
    transactions: Transaction[];
    onClick: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, transactions, onClick }) => {
    const theme = ASSET_THEMES[asset.type];
    const creditStats = useMemo(() => {
        if (asset.type !== AssetType.CREDIT_CARD) return null;
        return FinanceCalculator.calculateCreditCardBalances(asset, transactions);
    }, [asset, transactions]);

    // Masked Number (Last 4)
    const maskedNumber = asset.accountNumber ? `•••• ${asset.accountNumber.slice(-4)}` : '';

    return (
        <div onClick={onClick} className={`group relative h-48 rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${theme.bg} text-white shadow-md`}>
            {/* Premium Background Effects */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:opacity-15 transition-opacity"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-10 rounded-full blur-2xl"></div>

            {/* Glass Texture */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50"></div>

            <div className="p-6 h-full flex flex-col justify-between relative z-10">
                {/* Header: Institution & Badge */}
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="font-bold text-xs tracking-wider opacity-70 uppercase">
                            {asset.institution || 'SmartPenny'}
                        </span>
                    </div>
                    {/* Restored Asset Type Badge */}
                    <span className="px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md text-[9px] font-bold tracking-widest uppercase border border-white/10 shadow-sm">
                        {asset.type.replace('_', ' ')}
                    </span>
                </div>

                {/* Content: Name, Number & Balance */}
                <div className="space-y-1 mt-auto">
                    <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-2">
                            <h3 className="font-medium text-lg opacity-90 truncate tracking-tight leading-tight">{asset.name}</h3>
                            {maskedNumber && (
                                <p className="font-mono text-xs opacity-60 tracking-widest text-shadow-sm mt-0.5">
                                    {maskedNumber}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                        <h2 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                            {asset.balance.toLocaleString()}
                        </h2>
                        <span className="text-sm font-medium opacity-60">KRW</span>
                    </div>

                    {/* Credit Card Specific Stats (Mini) */}
                    {asset.type === AssetType.CREDIT_CARD && creditStats && (
                        <div className="mt-3 pt-3 border-t border-white/10 flex gap-4">
                            <div>
                                <p className="text-[10px] uppercase font-bold opacity-60">Past Debt</p>
                                <p className="text-sm font-bold">{Math.round(creditStats.pastDue).toLocaleString()}</p>
                            </div>
                            <div className="pl-4 border-l border-white/10">
                                <p className="text-[10px] uppercase font-bold opacity-60">Next Bill</p>
                                <p className="text-sm font-bold">{Math.round(creditStats.nextBill).toLocaleString()}</p>
                            </div>
                            {asset.limit && (
                                <div className="pl-4 border-l border-white/10 hidden sm:block">
                                    <p className="text-[10px] uppercase font-bold opacity-60">Utilization</p>
                                    <p className="text-sm font-bold">{Math.round((Math.abs(asset.balance) / asset.limit) * 100)}%</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

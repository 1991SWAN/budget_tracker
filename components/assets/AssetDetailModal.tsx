import React, { useState, useRef, useMemo } from 'react';
import { Asset, AssetType, Transaction, TransactionType } from '../../types';
import { FinanceCalculator } from '../../services/financeCalculator';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ASSET_THEMES } from './constants';
import { SafeChart } from './SafeChart';
import { SupabaseService } from '../../services/supabaseService';
import { useEffect } from 'react';

export const AssetDetailModal: React.FC<{
    asset: Asset,
    transactions: Transaction[],
    onClose: () => void,
    onEdit: () => void,
    onDelete: () => void,
    onPay?: (asset: Asset) => void,
    onClearHistory?: (assetId: string) => void
}> = ({ asset, transactions, onClose, onEdit, onDelete, onPay, onClearHistory }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    const chartData = useMemo(() => {
        const relevantTxs = transactions
            .filter(t => t.assetId === asset.id || t.toAssetId === asset.id)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningBalance = asset.balance;
        const history: { date: string, balance: number }[] = [];
        history.push({ date: new Date().toISOString().split('T')[0], balance: asset.balance });

        [...relevantTxs].reverse().forEach(tx => {
            const isIncoming = (tx.type === TransactionType.INCOME) || (tx.type === TransactionType.TRANSFER && tx.toAssetId === asset.id);
            const amount = tx.amount;
            if (isIncoming) runningBalance -= amount;
            else runningBalance += amount;
            history.push({ date: tx.date, balance: runningBalance });
        });
        return history.slice(0, 30).reverse();
    }, [asset, transactions]);

    const creditStats = useMemo(() => {
        if (asset.type !== AssetType.CREDIT_CARD) return null;
        return FinanceCalculator.calculateCreditCardBalances(asset, transactions);
    }, [asset, transactions]);

    const theme = ASSET_THEMES[asset.type];
    const [activeTab, setActiveTab] = useState<'overview' | 'simulation' | 'installments'>('overview');

    const [isDeleting, setIsDeleting] = useState(false);
    const [isClearing, setIsClearing] = useState(false); // New State: History Clear Confirmation

    const [allInstallments, setAllInstallments] = useState<Transaction[]>([]);
    const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);

    useEffect(() => {
        if (activeTab === 'installments' && asset.type === AssetType.CREDIT_CARD) {
            setIsLoadingInstallments(true);
            SupabaseService.getInstallmentsByAsset(asset.id).then(data => {
                setAllInstallments(data);
                setIsLoadingInstallments(false);
            });
        }
    }, [activeTab, asset.id, asset.type]);

    const footerContent = isDeleting ? (
        <>
            <div className="flex-1 flex items-center justify-center text-sm font-bold text-rose-600 animate-pulse">Are you sure?</div>
            <Button onClick={() => setIsDeleting(false)} variant="ghost" size="md">Cancel</Button>
            <Button onClick={onDelete} variant="destructive" size="md">Yes, Delete</Button>
        </>
    ) : isClearing ? (
        <>
            <div className="flex-1 flex flex-col items-center justify-center text-xs font-bold text-rose-600">
                <span className="animate-pulse text-sm">❗ Really Clear History?</span>
                <span className="opacity-70">This month's stats will be lost.</span>
            </div>
            <Button onClick={() => setIsClearing(false)} variant="ghost" size="md">Cancel</Button>
            <Button onClick={() => { onClearHistory?.(asset.id); setIsClearing(false); }} variant="secondary" size="md" className="bg-rose-100 text-rose-700 hover:bg-rose-200">Yes, Clear</Button>
        </>
    ) : (
        <>
            {asset.type === AssetType.CREDIT_CARD && onPay && (
                <Button onClick={() => onPay(asset)} variant="secondary" className="flex-1">💸 Pay Bill</Button>
            )}
            <Button onClick={onEdit} variant="outline" className="flex-1">Edit Details</Button>
            {onClearHistory && (
                <Button onClick={() => setIsClearing(true)} variant="ghost" className="px-3 text-slate-400 hover:text-slate-600 text-xs" title="Clear Transaction History">
                    Clear History 🧹
                </Button>
            )}
            <Button onClick={() => setIsDeleting(true)} variant="destructive" className="px-6">Delete Asset</Button>
        </>
    );

    return (
        <Dialog
            isOpen={true}
            onClose={onClose}
            title=""
            maxWidth="2xl"
            footer={footerContent}
        >
            <div className="-m-6">
                <div className={`p-6 ${theme.bg} text-white relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-10 opacity-10 text-9xl transform translate-x-10 -translate-y-10 pointer-events-none">{theme.icon}</div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="opacity-80 font-medium tracking-wide uppercase text-sm mb-1">{asset.type.replace('_', ' ')}</p>
                            <h2 className="text-3xl font-bold mb-2">{asset.name}</h2>
                            <h1 className="text-4xl font-extrabold tracking-tight">{asset.balance.toLocaleString()} <span className="text-lg opacity-70 font-normal">KRW</span></h1>
                        </div>
                        {/* X Button Removed */}
                    </div>
                </div>

                {(asset.type === AssetType.LOAN || asset.type === AssetType.CREDIT_CARD) && (
                    <div className="flex border-b border-slate-100 px-4 pt-2 gap-2 bg-white">
                        <Button
                            variant="ghost"
                            onClick={() => setActiveTab('overview')}
                            className={`rounded-b-none border-b-2 rounded-t-lg ${activeTab === 'overview' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-400'}`}
                        >
                            Overview
                        </Button>
                        {asset.type === AssetType.LOAN && (
                            <Button
                                variant="ghost"
                                onClick={() => setActiveTab('simulation')}
                                className={`rounded-b-none border-b-2 rounded-t-lg ${activeTab === 'simulation' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-400'}`}
                            >
                                Payoff Plan
                            </Button>
                        )}
                        {asset.type === AssetType.CREDIT_CARD && (
                            <Button
                                variant="ghost"
                                onClick={() => setActiveTab('installments')}
                                className={`rounded-b-none border-b-2 rounded-t-lg ${activeTab === 'installments' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-400'}`}
                            >
                                Installments
                            </Button>
                        )}
                    </div>
                )}

                <div className="p-6 space-y-8 bg-white min-h-[300px]">
                    {activeTab === 'overview' && (
                        <>
                            {asset.type === AssetType.CREDIT_CARD && creditStats && (
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="col-span-2 bg-slate-800 p-5 rounded-2xl text-white shadow-lg flex justify-between items-center">
                                        <div>
                                            <p className="text-xs opacity-70 font-bold uppercase mb-1">Total Outstanding Debt</p>
                                            <p className="text-3xl font-black">{Math.abs(asset.balance).toLocaleString()} <span className="text-base font-medium opacity-50">KRW</span></p>
                                        </div>
                                        <div className="text-4xl opacity-20">🏦</div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Past Due / Due</p>
                                        <p className="text-2xl font-extrabold text-slate-900">{Math.round(creditStats.pastDue).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Next Bill</p>
                                        <p className="text-2xl font-extrabold text-slate-900">{Math.round(creditStats.nextBill).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 col-span-2">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Future Unbilled</p>
                                        <p className="text-2xl font-extrabold text-slate-600 italic">+{Math.round(creditStats.unbilled).toLocaleString()} <span className="text-xs font-normal opacity-50 uppercase">in future installments</span></p>
                                    </div>
                                </div>
                            )}

                            <div className="w-full">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><span>📉</span> Balance Trend (30 Days)</h4>
                                <div className="h-48 w-full min-w-0">
                                    {/* SafeChart prevents 0-size warnings */}
                                    <SafeChart data={chartData} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {asset.type === AssetType.CREDIT_CARD && asset.creditDetails && (
                                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 col-span-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-xs text-destructive font-bold uppercase">Usage Period</p>
                                            <p className="text-xs font-bold text-rose-800">{asset.creditDetails.billingCycle.usageStartDay}st ~ End of Month</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-xs text-destructive font-bold uppercase">Pays On</p>
                                            <p className="text-xs font-bold text-rose-800">{asset.creditDetails.billingCycle.paymentDay}th</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'installments' && asset.type === AssetType.CREDIT_CARD && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg text-slate-800 mb-4">Active Installments</h3>
                            {isLoadingInstallments ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading Installments...</p>
                                </div>
                            ) : allInstallments.length === 0 ? (
                                <p className="text-center text-slate-400 py-10 italic">No active installments found.</p>
                            ) : (
                                allInstallments.map(tx => {
                                    if (!tx.installment) return null;
                                    return (
                                        <div key={tx.id} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{tx.memo.replace(/ \(\d+M Installment\)/, '')}</p>
                                                    <p className="text-xs text-slate-400">{tx.date}</p>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <p className="font-bold text-destructive">-{tx.amount.toLocaleString()}</p>
                                                    <p className="text-[11px] font-bold text-slate-500 mb-1">(월 {Math.round(tx.amount / tx.installment.totalMonths).toLocaleString()})</p>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${tx.installment.isInterestFree ? 'bg-emerald-50 text-secondary border-emerald-100' : 'bg-rose-50 text-destructive border-rose-100'}`}>{tx.installment.isInterestFree ? '무이자' : '이자'}</span>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <div className="flex justify-between text-xs font-bold mb-1">
                                                    <span className="text-blue-600">
                                                        {/* Calculated Progress */}
                                                        {Math.min(tx.installment.totalMonths, Math.max(1, (new Date().getFullYear() - new Date(tx.date).getFullYear()) * 12 + (new Date().getMonth() - new Date(tx.date).getMonth()) + 1))} / {tx.installment.totalMonths} Month
                                                    </span>
                                                    <span className="text-slate-400">
                                                        {Math.round((Math.min(tx.installment.totalMonths, Math.max(1, (new Date().getFullYear() - new Date(tx.date).getFullYear()) * 12 + (new Date().getMonth() - new Date(tx.date).getMonth()) + 1)) / tx.installment.totalMonths) * 100)}%
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(Math.min(tx.installment.totalMonths, Math.max(1, (new Date().getFullYear() - new Date(tx.date).getFullYear()) * 12 + (new Date().getMonth() - new Date(tx.date).getMonth()) + 1)) / tx.installment.totalMonths) * 100}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    );
};

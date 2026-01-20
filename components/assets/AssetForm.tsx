import React, { useState, useEffect } from 'react';
import { Asset, AssetType, CreditCardDetails, LoanDetails, BankDetails, InvestmentDetails } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface AssetFormProps {
    initialData?: Partial<Asset>;
    onSave: (asset: Asset) => void;
    onCancel: () => void;
    isEditing?: boolean;
}

export const AssetForm: React.FC<AssetFormProps> = ({ initialData, onSave, onCancel, isEditing = false }) => {
    const [formData, setFormData] = useState<Partial<Asset>>({
        name: '',
        type: AssetType.CHECKING,
        balance: 0,
        initialBalance: 0,
        currency: 'KRW',
        description: '',
        ...initialData
    });

    const [isHistoricalMode, setIsHistoricalMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Local state for complex nested structures
    const [creditForm, setCreditForm] = useState<Partial<CreditCardDetails>>(initialData?.creditDetails || { limit: 0, apr: 15.0, billingCycle: { usageStartDay: 1, usageEndDay: 30, paymentDay: 14 } });
    const [loanForm, setLoanForm] = useState<Partial<LoanDetails>>(initialData?.loanDetails || { principal: 0, interestRate: 5.0, startDate: new Date().toISOString().split('T')[0], termMonths: 12, paymentType: 'AMORTIZATION' });
    const [bankForm, setBankForm] = useState<Partial<BankDetails>>(initialData?.bankDetails || { interestRate: 2.0, isMainAccount: false });
    const [investmentForm, setInvestmentForm] = useState<Partial<InvestmentDetails>>(initialData?.investmentDetails || { symbol: '', quantity: 0, purchasePrice: 0, currentPrice: 0, address: '' });

    // Sync initialData
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...initialData }));
            setCreditForm(prev => ({ ...prev, ...initialData.creditDetails }));
            setLoanForm(prev => ({ ...prev, ...initialData.loanDetails }));
            setBankForm(prev => ({ ...prev, ...initialData.bankDetails }));
            setInvestmentForm(prev => ({ ...prev, ...initialData.investmentDetails }));
        }
    }, [initialData]);

    const handleSubmit = async () => {
        if (!formData.name) {
            setError("Name is required.");
            return;
        }

        setError(null);
        setIsSaving(true);

        try {
            let detectedMode: 'TRANSACTION' | 'SETTING' = isHistoricalMode ? 'SETTING' : 'TRANSACTION';

            const assetToSave: Asset = {
                id: initialData?.id || Date.now().toString(),
                name: formData.name,
                type: formData.type as AssetType,
                balance: Number(formData.balance),
                // If historical mode, we compute the shifted initial balance
                initialBalance: isEditing
                    ? (isHistoricalMode
                        ? (Number(initialData?.initialBalance || 0) + (Number(formData.balance) - Number(initialData?.balance || 0)))
                        : Number(formData.initialBalance))
                    : Number(formData.balance),
                currency: formData.currency || 'KRW',
                description: formData.description,
                institution: formData.institution,
                accountNumber: formData.accountNumber,
                excludeFromTotal: formData.excludeFromTotal,
                theme: formData.theme,
                _adjustmentMode: detectedMode,
            } as any;

            if (formData.type === AssetType.CHECKING || formData.type === AssetType.SAVINGS) {
                assetToSave.bankDetails = bankForm as BankDetails;
            } else if (formData.type === AssetType.INVESTMENT) {
                assetToSave.investmentDetails = investmentForm as InvestmentDetails;
            } else if (formData.type === AssetType.CREDIT_CARD) {
                assetToSave.creditDetails = creditForm as CreditCardDetails;
                assetToSave.limit = Number(creditForm.limit);
                if (!isEditing && assetToSave.balance > 0) assetToSave.balance = -assetToSave.balance;
            } else if (formData.type === AssetType.LOAN) {
                assetToSave.loanDetails = loanForm as LoanDetails;
                if (assetToSave.balance > 0) assetToSave.balance = -assetToSave.balance;
            }

            await onSave(assetToSave);
        } catch (e) {
            console.error("Save failed", e);
            setError("Save failed.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4 pb-2 h-full flex flex-col overflow-hidden">
            <div className="px-1">
                <h1 className="text-xl font-bold text-primary">{isEditing ? 'Edit Asset' : 'New Asset'}</h1>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-5">
                {/* Core Identification */}
                <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4">
                        <Select
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value as AssetType })}
                            options={Object.values(AssetType).map(t => ({ value: t, label: t }))}
                        />
                    </div>
                    <div className="col-span-8">
                        <Input
                            value={formData.name}
                            onChange={e => { setFormData({ ...formData, name: e.target.value }); if (error) setError(null); }}
                            placeholder="Asset Name"
                            className={error ? "border-rose-500" : ""}
                        />
                    </div>
                </div>

                {/* Compact Balance Input */}
                <div className="bg-slate-900 rounded-3xl p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Balance</p>
                        {isEditing && (
                            <div className="flex bg-white/10 rounded-full p-0.5 border border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setIsHistoricalMode(false)}
                                    className={`px-3 py-0.5 rounded-full text-[9px] font-black transition-all duration-300 ${!isHistoricalMode ? 'bg-white text-slate-900 shadow-sm' : 'text-white/30 hover:text-white/50'}`}
                                >
                                    SPOT
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsHistoricalMode(true)}
                                    className={`px-3 py-0.5 rounded-full text-[9px] font-black transition-all duration-300 ${isHistoricalMode ? 'bg-emerald-500 text-white shadow-sm' : 'text-white/30 hover:text-white/50'}`}
                                >
                                    HISTORICAL
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black opacity-20">₩</span>
                        <input
                            type="number"
                            value={formData.type === AssetType.LOAN ? Math.abs(formData.balance || 0) : formData.balance}
                            onChange={e => setFormData({ ...formData, balance: formData.type === AssetType.LOAN ? -Number(e.target.value) : Number(e.target.value) })}
                            className="bg-transparent border-none focus:ring-0 text-2xl font-black w-full p-0 placeholder:text-white/10"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Secondary Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <Input
                        placeholder="Institution"
                        value={formData.institution || ''}
                        onChange={e => setFormData({ ...formData, institution: e.target.value })}
                    />
                    <Input
                        placeholder="Account Last 4"
                        value={formData.accountNumber || ''}
                        onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                        maxLength={4}
                    />
                </div>

                {/* Contextual Details (Compact) */}
                {formData.type === AssetType.CREDIT_CARD && (
                    <div className="bg-rose-50/50 p-4 rounded-3xl border border-rose-100/50 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Limit"
                                type="number"
                                size="sm"
                                value={creditForm.limit}
                                onChange={e => setCreditForm({ ...creditForm, limit: Number(e.target.value) })}
                            />
                            <Input
                                label="APR %"
                                type="number"
                                size="sm"
                                value={creditForm.apr}
                                onChange={e => setCreditForm({ ...creditForm, apr: Number(e.target.value) })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-rose-100/50 pt-3">
                            <div className="col-span-2">
                                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-2 ml-1">Billing Cycle</p>
                            </div>
                            <Input
                                label="Pay Day"
                                type="number"
                                placeholder="e.g. 14"
                                size="sm"
                                value={creditForm.billingCycle?.paymentDay}
                                onChange={e => setCreditForm({
                                    ...creditForm,
                                    billingCycle: { ...creditForm.billingCycle!, paymentDay: Number(e.target.value) }
                                })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    label="Start"
                                    type="number"
                                    placeholder="1"
                                    size="sm"
                                    value={creditForm.billingCycle?.usageStartDay}
                                    onChange={e => setCreditForm({
                                        ...creditForm,
                                        billingCycle: { ...creditForm.billingCycle!, usageStartDay: Number(e.target.value) }
                                    })}
                                />
                                <Input
                                    label="End"
                                    type="number"
                                    placeholder="30"
                                    size="sm"
                                    value={creditForm.billingCycle?.usageEndDay}
                                    onChange={e => setCreditForm({
                                        ...creditForm,
                                        billingCycle: { ...creditForm.billingCycle!, usageEndDay: Number(e.target.value) }
                                    })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {(formData.type === AssetType.CHECKING || formData.type === AssetType.SAVINGS) && (bankForm.interestRate || 0) !== 0 && (
                    <div className="bg-slate-50 p-3 rounded-3xl border border-slate-100 flex gap-2">
                        <Input label="Rate %" type="number" size="sm" value={bankForm.interestRate} onChange={e => setBankForm({ ...bankForm, interestRate: Number(e.target.value) })} />
                    </div>
                )}

                {/* Description & Settings */}
                <div className="space-y-3">
                    <Input
                        placeholder="Description (Optional)"
                        value={formData.description || ''}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        size="sm"
                    />
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 cursor-pointer px-1">
                        <input
                            type="checkbox"
                            checked={formData.excludeFromTotal || false}
                            onChange={e => setFormData({ ...formData, excludeFromTotal: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                        />
                        Exclude from Net Worth
                    </label>
                </div>
            </div>

            <div className="pt-3 flex gap-2 px-1 border-t border-slate-100 mt-auto">
                <Button onClick={onCancel} variant="ghost" size="sm" className="flex-1 rounded-full">Cancel</Button>
                <Button onClick={handleSubmit} className="flex-2 rounded-full shadow-md" size="sm" isLoading={isSaving} disabled={isSaving}>
                    {isEditing ? 'Save' : 'Create'}
                </Button>
            </div>
            {error && <p className="text-[10px] text-rose-500 font-bold px-1 mt-1 text-center">⚠️ {error}</p>}
        </div>
    );
};

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
        name: '', type: AssetType.CHECKING, balance: 0, currency: 'KRW', description: '', ...initialData
    });

    // Local state for complex nested structures
    const [creditForm, setCreditForm] = useState<Partial<CreditCardDetails>>(initialData?.creditDetails || { limit: 0, apr: 15.0, billingCycle: { usageStartDay: 1, usageEndDay: 30, paymentDay: 14 } });
    const [loanForm, setLoanForm] = useState<Partial<LoanDetails>>(initialData?.loanDetails || { principal: 0, interestRate: 5.0, startDate: new Date().toISOString().split('T')[0], termMonths: 12, paymentType: 'AMORTIZATION' });
    const [bankForm, setBankForm] = useState<Partial<BankDetails>>(initialData?.bankDetails || { interestRate: 2.0, isMainAccount: false });
    const [investmentForm, setInvestmentForm] = useState<Partial<InvestmentDetails>>(initialData?.investmentDetails || { symbol: '', quantity: 0, purchasePrice: 0, currentPrice: 0, address: '' });

    // Ensure formData syncs if initialData changes while mounted (safety)
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...initialData }));
            setCreditForm(prev => ({ ...prev, ...initialData.creditDetails }));
            setLoanForm(prev => ({ ...prev, ...initialData.loanDetails }));
            setBankForm(prev => ({ ...prev, ...initialData.bankDetails }));
            setInvestmentForm(prev => ({ ...prev, ...initialData.investmentDetails }));
        }
    }, [initialData]);

    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        if (!formData.name) {
            setError("Please enter an asset name.");
            return;
        }
        setError(null);
        setIsSaving(true);

        try {
            const assetToSave: Asset = {
                id: initialData?.id || Date.now().toString(),
                name: formData.name,
                type: formData.type as AssetType,
                balance: Number(formData.balance),
                currency: formData.currency || 'KRW',
                description: formData.description,
                institution: formData.institution,
                accountNumber: formData.accountNumber,
                excludeFromTotal: formData.excludeFromTotal,
                theme: formData.theme,
            };

            if (formData.type === AssetType.CHECKING || formData.type === AssetType.SAVINGS) {
                assetToSave.bankDetails = bankForm as BankDetails;
                if (formData.type === AssetType.SAVINGS) assetToSave.interestRate = bankForm.interestRate;
            } else if (formData.type === AssetType.INVESTMENT) {
                assetToSave.investmentDetails = investmentForm as InvestmentDetails;
            } else if (formData.type === AssetType.CREDIT_CARD) {
                assetToSave.creditDetails = creditForm as CreditCardDetails;
                assetToSave.limit = Number(creditForm.limit);
                // Only flip sign on creation. If editing, preserve existing sign (even if positive, to avoid phantom diffs).
                if (!isEditing && assetToSave.balance > 0) assetToSave.balance = -assetToSave.balance;
            } else if (formData.type === AssetType.LOAN) {
                assetToSave.loanDetails = loanForm as LoanDetails;
                if (assetToSave.balance > 0) assetToSave.balance = -assetToSave.balance;
            }

            await onSave(assetToSave);
        } catch (e) {
            console.error("Save failed", e);
            setError("Failed to save asset.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 pb-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                <div>
                    <h1 className="text-3xl font-bold text-primary">Assets</h1>
                    <p className="text-muted">Track your net worth and manage accounts.</p>
                </div>
            </div>

            <div className="space-y-6 pb-6">
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                        <Select
                            label="Type"
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value as AssetType })}
                            options={Object.values(AssetType).map(t => ({ value: t, label: t }))}
                        />
                    </div>
                    <div className="col-span-2">
                        <Input
                            label="Asset Name"
                            value={formData.name}
                            onChange={e => { setFormData({ ...formData, name: e.target.value }); if (error) setError(null); }}
                            placeholder="e.g. Main Chase"
                            className={error ? "border-rose-500 ring-rose-500" : ""}
                        />
                        {error && <p className="text-xs text-rose-500 font-bold mt-1 ml-1">⚠️ {error}</p>}
                    </div>
                </div>

                <div>
                    <Input
                        label={formData.type === AssetType.CREDIT_CARD ? 'Initial Debt (기존 잔액)' : formData.type === AssetType.LOAN ? 'Current Principal Remaining' : 'Current Balance'}
                        type="number"
                        value={formData.type === AssetType.LOAN ? Math.abs(formData.balance || 0) : formData.balance}
                        onChange={e => setFormData({ ...formData, balance: formData.type === AssetType.LOAN ? -Number(e.target.value) : Number(e.target.value) })}
                        disabled={isEditing && formData.type === AssetType.CREDIT_CARD}
                        leftIcon="₩"
                        className={`text-lg font-bold ${isEditing && formData.type === AssetType.CREDIT_CARD ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                    />
                    <div className="flex items-center justify-end mt-2">
                        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.excludeFromTotal || false}
                                onChange={e => setFormData({ ...formData, excludeFromTotal: e.target.checked })}
                                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            Exclude from Net Worth
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="Institution / Bank"
                        placeholder="e.g. Chase"
                        value={formData.institution || ''}
                        onChange={e => setFormData({ ...formData, institution: e.target.value })}
                        className="bg-white"
                    />
                    <Input
                        label="Account Number (Last 4)"
                        placeholder="1234"
                        value={formData.accountNumber || ''}
                        onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                        maxLength={4}
                        className="bg-white"
                    />
                </div>

                {/* Bank Details */}
                {(formData.type === AssetType.CHECKING || formData.type === AssetType.SAVINGS) && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                        <h4 className="text-sm font-bold text-slate-700">🏦 Bank Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Interest Rate %" type="number" value={bankForm.interestRate} onChange={e => setBankForm({ ...bankForm, interestRate: Number(e.target.value) })} className="bg-white" />
                            <Input label="Maturity Date" type="date" value={bankForm.maturityDate} onChange={e => setBankForm({ ...bankForm, maturityDate: e.target.value })} className="bg-white" />
                        </div>
                    </div>
                )}

                {/* Investment & Real Estate Details */}
                {formData.type === AssetType.INVESTMENT && (
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-4">
                        <h4 className="text-sm font-bold text-emerald-800">📈 Investment / Asset Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Symbol / Name" placeholder="AAPL" value={investmentForm.symbol} onChange={e => setInvestmentForm({ ...investmentForm, symbol: e.target.value })} className="bg-white" />
                            <Input label="Quantity" type="number" value={investmentForm.quantity} onChange={e => setInvestmentForm({ ...investmentForm, quantity: Number(e.target.value) })} className="bg-white" />
                            <Input label="Purchase Price" type="number" value={investmentForm.purchasePrice} onChange={e => setInvestmentForm({ ...investmentForm, purchasePrice: Number(e.target.value) })} className="bg-white" />
                            <Input label="Current Price" type="number" value={investmentForm.currentPrice} onChange={e => setInvestmentForm({ ...investmentForm, currentPrice: Number(e.target.value) })} className="bg-white" />
                        </div>
                        <Input label="Address / Model (Real Estate/Car)" placeholder="Optional" value={investmentForm.address} onChange={e => setInvestmentForm({ ...investmentForm, address: e.target.value })} className="bg-white" />
                    </div>
                )}

                {formData.type === AssetType.CREDIT_CARD && (
                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 space-y-4">
                        <h4 className="text-sm font-bold text-rose-700 flex items-center gap-2"><span>💳</span> Credit Configuration</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Limit" type="number" value={creditForm.limit} onChange={e => setCreditForm({ ...creditForm, limit: Number(e.target.value) })} className="bg-white border-rose-200" />
                            <Input label="APR %" type="number" value={creditForm.apr} onChange={e => setCreditForm({ ...creditForm, apr: Number(e.target.value) })} className="bg-white border-rose-200" />
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-rose-100">
                            <p className="text-xs font-bold text-slate-500 mb-2">Billing Cycle</p>
                            <div className="flex items-center gap-2 text-sm mb-2">
                                <label htmlFor="usage-start-day" className="w-16 font-bold text-slate-400 text-xs uppercase">Usage</label>
                                <input id="usage-start-day" type="number" min="1" max="31" value={creditForm.billingCycle?.usageStartDay} onChange={e => setCreditForm({ ...creditForm, billingCycle: { ...creditForm.billingCycle!, usageStartDay: Number(e.target.value) } })} className="w-12 p-1 border rounded text-center bg-slate-50" />
                                <span className="text-xs text-slate-400">st ~ End of Month</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <label htmlFor="payment-day" className="w-16 font-bold text-slate-400 text-xs uppercase">Pays On</label>
                                <input id="payment-day" type="number" min="1" max="31" value={creditForm.billingCycle?.paymentDay} onChange={e => setCreditForm({ ...creditForm, billingCycle: { ...creditForm.billingCycle!, paymentDay: Number(e.target.value) } })} className="w-12 p-1 border rounded text-center bg-rose-50 font-bold border-rose-200 text-rose-700" />
                                <span className="text-xs text-slate-400">th next month</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm mt-2">
                                <label className="w-16 font-bold text-slate-400 text-xs uppercase">Pay Date</label>
                                <input type="number" min="1" max="31" value={creditForm.paymentDate} onChange={e => setCreditForm({ ...creditForm, paymentDate: Number(e.target.value) })} className="w-12 p-1 border rounded text-center bg-white" />
                                <span className="text-xs text-slate-400">(Auto-payment date)</span>
                            </div>
                        </div>
                    </div>
                )}

                {formData.type === AssetType.LOAN && (
                    <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 space-y-4">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><span>🏦</span> Loan Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Principal" type="number" value={loanForm.principal} onChange={e => setLoanForm({ ...loanForm, principal: Number(e.target.value) })} className="bg-white border-slate-300" />
                            <Input label="Rate %" type="number" value={loanForm.interestRate} onChange={e => setLoanForm({ ...loanForm, interestRate: Number(e.target.value) })} className="bg-white border-slate-300" />
                            <Input label="Start Date" type="date" value={loanForm.startDate} onChange={e => setLoanForm({ ...loanForm, startDate: e.target.value })} className="bg-white border-slate-300" />
                            <Input label="Term (Mo)" type="number" value={loanForm.termMonths} onChange={e => setLoanForm({ ...loanForm, termMonths: Number(e.target.value) })} className="bg-white border-slate-300" />
                            <Input label="End Date (Est)" type="date" value={loanForm.endDate} onChange={e => setLoanForm({ ...loanForm, endDate: e.target.value })} className="bg-white border-slate-300" />
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Payment Type</label>
                                <select
                                    value={loanForm.paymentType}
                                    onChange={e => setLoanForm({ ...loanForm, paymentType: e.target.value as any })}
                                    className="w-full p-2 rounded-xl border border-slate-300 text-sm bg-white"
                                >
                                    <option value="AMORTIZATION">Amortization (원리금균등)</option>
                                    <option value="INTEREST_ONLY">Interest Only (만기일시)</option>
                                </select>
                            </div>

                        </div>
                    </div>
                )}

                <div className="pt-4 mt-auto flex gap-3">
                    <Button onClick={onCancel} variant="ghost" size="lg" className="flex-1">Cancel</Button>
                    <Button onClick={handleSubmit} className="flex-1" size="lg" isLoading={isSaving} disabled={isSaving}>Save Asset</Button>
                </div>
            </div>
        </div>
    );
};

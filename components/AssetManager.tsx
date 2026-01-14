import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Asset, AssetType, Transaction, TransactionType, CreditCardDetails, LoanDetails, BankDetails, InvestmentDetails } from '../types';
import { useModalClose } from '../hooks/useModalClose';
import { FinanceCalculator } from '../services/financeCalculator';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Dialog } from './ui/Dialog';

const ASSET_THEMES: Record<AssetType, { bg: string, text: string, icon: string, border: string }> = {
  [AssetType.CASH]: {
    bg: 'bg-emerald-500', // Asset -> Growth (Emerald)
    text: 'text-white',
    icon: '💵',
    border: 'border-emerald-400'
  },
  [AssetType.CHECKING]: {
    bg: 'bg-slate-800', // Main Transactional -> Trust (Slate)
    text: 'text-white',
    icon: '💳',
    border: 'border-slate-600'
  },
  [AssetType.SAVINGS]: {
    bg: 'bg-emerald-600', // Savings -> Deep Growth (Emerald)
    text: 'text-white',
    icon: '🐷',
    border: 'border-emerald-500'
  },
  [AssetType.CREDIT_CARD]: {
    bg: 'bg-rose-500', // Debt/Spending -> Warning (Rose)
    text: 'text-white',
    icon: '💳',
    border: 'border-rose-400'
  },
  [AssetType.INVESTMENT]: {
    bg: 'bg-emerald-700', // Investment -> Long term (Dark Emerald)
    text: 'text-white',
    icon: '📈',
    border: 'border-emerald-600'
  },
  [AssetType.LOAN]: {
    bg: 'bg-slate-500', // Loan -> Neutral/Burden (Lighter Slate)
    text: 'text-white',
    icon: '🏦',
    border: 'border-slate-400'
  },
};

// --- SafeChart Component ---
// Prevents Recharts from rendering with invalid dimensions (width/height <= 0) which causes console warnings.
const SafeChart = ({ data }: { data: any[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use contentRect for broader compatibility
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Double RAF to ensure layout is fully stable
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setShouldRender(true);
            });
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[1px] min-w-[1px]">
      {shouldRender ? (
        <ResponsiveContainer width="100%" height="100%" style={{ minWidth: 100, minHeight: 100 }}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBal)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="w-full h-full bg-slate-50 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-300">
          Loading Chart...
        </div>
      )}
    </div>
  );
};

// --- Asset Form ---
interface AssetFormProps {
  initialData?: Partial<Asset>;
  onSave: (asset: Asset) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const AssetForm: React.FC<AssetFormProps> = ({ initialData, onSave, onCancel, isEditing = false }) => {
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
        // Balance for investment is usually quantity * currentPrice, but we verify this logic later.
        // For now, let user override balance or we can auto-calc. Defaulting to manual balance.
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

// --- Asset Detail Modal ---
const AssetDetailModal: React.FC<{ asset: Asset, transactions: Transaction[], onClose: () => void, onEdit: () => void, onDelete: () => void, onPay?: (asset: Asset) => void }> = ({ asset, transactions, onClose, onEdit, onDelete, onPay }) => {
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
  // The system prompt says "To edit multiple, non-adjacent lines ... make a single call to the multi_replace_file_content tool".
  // I will use multi_replace_file_content.

  const [isDeleting, setIsDeleting] = useState(false);

  const footerContent = isDeleting ? (
    <>
      <div className="flex-1 flex items-center justify-center text-sm font-bold text-rose-600 animate-pulse">Are you sure?</div>
      <Button onClick={() => setIsDeleting(false)} variant="ghost" size="md">Cancel</Button>
      <Button onClick={onDelete} variant="destructive" size="md">Yes, Delete</Button>
    </>
  ) : (
    <>
      {asset.type === AssetType.CREDIT_CARD && onPay && (
        <Button onClick={() => onPay(asset)} variant="secondary" className="flex-1">💸 Pay Bill</Button>
      )}
      <Button onClick={onEdit} variant="outline" className="flex-1">Edit Details</Button>
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
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Next Bill (Est.)</p>
                    <p className="text-2xl font-extrabold text-slate-900">{Math.round(creditStats.statementBalance).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Future Unbilled</p>
                    <p className="text-2xl font-extrabold text-slate-900">{Math.round(creditStats.unbilledBalance).toLocaleString()}</p>
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
              {transactions.filter(t => t.assetId === asset.id && t.installment).length === 0 ? (
                <p className="text-center text-slate-400 py-10 italic">No active installments found.</p>
              ) : (
                transactions.filter(t => t.assetId === asset.id && t.installment).map(tx => {
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

// --- Asset Card Wrapper ---
const AssetCard: React.FC<{ asset: Asset, transactions: Transaction[], onClick: () => void }> = ({ asset, transactions, onClick }) => {
  const theme = ASSET_THEMES[asset.type];
  const creditStats = useMemo(() => {
    if (asset.type !== AssetType.CREDIT_CARD) return null;
    return FinanceCalculator.calculateCreditCardBalances(asset, transactions);
  }, [asset, transactions]);

  return (
    <div onClick={onClick} className={`group relative h-48 rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${theme.bg} text-white shadow-lg`}>
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-5 rounded-full blur-2xl"></div>

      <div className="p-5 h-full flex flex-col justify-between relative z-10">
        <div className="flex justify-between items-start">
          <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-xl shadow-inner border border-white/10">{theme.icon}</div>
          <span className="px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md text-[9px] font-bold tracking-widest uppercase border border-white/10">{asset.type.replace('_', ' ')}</span>
        </div>
        <div>
          <h3 className="font-bold text-lg mb-0.5 truncate">{asset.name}</h3>
          <p className="text-3xl font-black tracking-tight">{asset.balance.toLocaleString()}</p>
          {(asset.type === AssetType.CREDIT_CARD) && creditStats && (
            <div className="mt-2 flex items-center gap-2 text-[10px] font-medium opacity-80 bg-black/20 self-start px-2 py-1 rounded-lg backdrop-blur-sm">
              <span>Next Bill:</span>
              <span className="font-bold text-white">{Math.round(creditStats.statementBalance).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



// ... (AssetForm and AssetDetailModal remain unchanged)

// --- Main Asset Manager ---
type AssetTab = 'all' | 'bank' | 'card' | 'loan' | 'other' | 'tools';

interface AssetManagerProps {
  assets: Asset[];
  transactions: Transaction[];
  onAdd: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (assetId: string) => void;
  onPay?: (asset: Asset) => void;
}

const AssetManager: React.FC<AssetManagerProps> = ({ assets, transactions, onAdd, onEdit, onDelete, onPay }) => {
  const [activeTab, setActiveTab] = useState<AssetTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Grouped Assets
  const groupedAssets = useMemo(() => {
    return {
      bank: assets.filter(a => [AssetType.CHECKING, AssetType.SAVINGS, AssetType.INVESTMENT].includes(a.type)),
      card: assets.filter(a => a.type === AssetType.CREDIT_CARD),
      loan: assets.filter(a => a.type === AssetType.LOAN),
      other: assets.filter(a => [AssetType.CASH].includes(a.type)) // Add new types here if needed
    };
  }, [assets]);

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSave = async (asset: Asset) => {
    if (isEditing) await onEdit(asset);
    else await onAdd(asset);
    setShowForm(false);
    setIsEditing(false);
    setSelectedAsset(null);
  };

  const handleDelete = () => {
    if (selectedAsset) {
      onDelete(selectedAsset.id);
      setSelectedAsset(null);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header with Title and Action */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h1 className="text-3xl font-bold text-primary">My Assets</h1>
          <p className="text-muted">Manage your accounts and track net worth.</p>
        </div>
        <div className="hidden md:block">
          <Button
            onClick={() => { setSelectedAsset(null); setIsEditing(false); setShowForm(true); }}
            className="rounded-2xl px-5 shadow-md flex items-center gap-2"
            aria-label="Add Asset"
          >
            <span>+</span>
            <span>Add Asset</span>
          </Button>
        </div>
      </div>

      {/* Header Tabs - Padding increased to prevent shadow clipping */}
      <div className="flex items-center gap-2 mb-4 p-2 overflow-x-auto no-scrollbar">
        {(['all', 'bank', 'card', 'loan', 'other', 'tools'] as AssetTab[]).map(tab => {
          const isActive = activeTab === tab;
          return (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              variant={isActive ? 'primary' : 'ghost'}
              className={`px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all flex-shrink-0 ${isActive
                ? 'shadow-md scale-105'
                : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                }`}
            >
              {tab}
            </Button>
          );
        })}
      </div>

      {/* Floating Action Button (FAB) for Add Asset - Mobile Only */}
      <Button
        onClick={() => { setSelectedAsset(null); setIsEditing(false); setShowForm(true); }}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-xl flex items-center justify-center z-50 transition-transform active:scale-95 hover:bg-slate-800 hover:shadow-2xl hover:-translate-y-1"
        aria-label="Add Asset"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </Button>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar pr-2">
        {activeTab === 'all' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Net Worth Summary */}
            <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-3xl p-6 text-white shadow-xl mb-8">
              <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-1">Total Net Worth</p>
              <h1 className="text-4xl font-black">{assets.filter(a => !a.excludeFromTotal).reduce((sum, a) => sum + a.balance, 0).toLocaleString()} <span className="text-lg font-normal opacity-50">KRW</span></h1>
            </div>

            {groupedAssets.bank.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🏦</span>
                  <h3 className="font-bold text-slate-700">Bank & Cash</h3>
                  <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">{groupedAssets.bank.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedAssets.bank.map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
                  {groupedAssets.other.map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
                </div>
              </section>
            )}

            {groupedAssets.card.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4 mt-6">
                  <span className="text-xl">💳</span>
                  <h3 className="font-bold text-slate-700">Credit Cards</h3>
                  <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">{groupedAssets.card.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedAssets.card.map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
                </div>
              </section>
            )}

            {groupedAssets.loan.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4 mt-6">
                  <span className="text-xl">💸</span>
                  <h3 className="font-bold text-slate-700">Loans</h3>
                  <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">{groupedAssets.loan.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedAssets.loan.map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
                </div>
              </section>
            )}
          </div>
        )}

        {(activeTab === 'bank' || activeTab === 'other') && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2">
            {[...groupedAssets.bank, ...groupedAssets.other].map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
          </div>
        )}

        {activeTab === 'card' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2">
            {groupedAssets.card.map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
          </div>
        )}

        {activeTab === 'loan' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2">
            {groupedAssets.loan.map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
          </div>
        )}

        {activeTab === 'tools' && (
          <EmptyState
            icon="🚧"
            title="Tools & Simulators coming soon"
            className="py-20 border-dashed border border-slate-100 rounded-3xl bg-slate-50"
          />
        )}
      </div>

      {/* Modals */}
      {/* Modals */}
      {showForm && (
        <Dialog
          isOpen={showForm}
          onClose={() => { setShowForm(false); setIsEditing(false); }}
          title=""
          maxWidth="lg"
        >
          <AssetForm initialData={selectedAsset || undefined} isEditing={isEditing} onSave={handleSave} onCancel={() => { setShowForm(false); setIsEditing(false); }} />
        </Dialog>
      )}

      {selectedAsset && !isEditing && (
        <AssetDetailModal
          asset={selectedAsset}
          transactions={transactions}
          onClose={() => setSelectedAsset(null)}
          onEdit={() => { setIsEditing(true); setShowForm(true); }}
          onDelete={handleDelete}
          onPay={onPay}
        />
      )}
    </div>
  );
};

export default AssetManager;

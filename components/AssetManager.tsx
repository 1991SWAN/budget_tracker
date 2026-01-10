import React, { useState, useRef, useMemo } from 'react';
import { Asset, AssetType, Transaction, TransactionType, CreditCardDetails, LoanDetails } from '../types';
import { useModalClose } from '../hooks/useModalClose';
import { FinanceCalculator } from '../services/financeCalculator';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

// --- Asset Form ---
// (Use Button, Card inside Form)
// Replace standard buttons with <Button>
// Replace container divs with <Card>

// --- Asset Detail Modal ---
// Use Button for actions.
// Use Badge for interest tags.

// --- Asset Card ---
// Use Card component as wrapper.

// --- Asset Manager Main ---
// Use Button for Tabs (maybe custom variant or just styled buttons, sticking to existing tab logic for now but using semantic colors).


interface AssetManagerProps {
  assets: Asset[];
  transactions: Transaction[];
  onAddAsset: (asset: Asset) => void;
  onUpdateAsset: (asset: Asset) => void;
  onDeleteAsset: (assetId: string) => void;
  onPay?: (asset: Asset) => void;
}

const ASSET_THEMES: Record<AssetType, { bg: string, text: string, icon: string, border: string }> = {
  [AssetType.CASH]: {
    bg: 'bg-secondary', // Emerald
    text: 'text-white',
    icon: '💵',
    border: 'border-emerald-200'
  },
  [AssetType.CHECKING]: {
    bg: 'bg-primary', // Slate 900
    text: 'text-white',
    icon: '💳',
    border: 'border-slate-700'
  },
  [AssetType.SAVINGS]: {
    bg: 'bg-slate-700', // Lighter Slate
    text: 'text-white',
    icon: '🐷',
    border: 'border-slate-600'
  },
  [AssetType.CREDIT_CARD]: {
    bg: 'bg-primary',
    text: 'text-white',
    icon: '💳',
    border: 'border-slate-800'
  },
  [AssetType.INVESTMENT]: {
    bg: 'bg-slate-800',
    text: 'text-white',
    icon: '📈',
    border: 'border-slate-700'
  },
  [AssetType.LOAN]: {
    bg: 'bg-slate-600',
    text: 'text-white',
    icon: '🏦',
    border: 'border-slate-500'
  },
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
  const [loanForm, setLoanForm] = useState<Partial<LoanDetails>>(initialData?.loanDetails || { principal: 0, interestRate: 5.0, startDate: new Date().toISOString().split('T')[0], termMonths: 12 });

  const handleSubmit = () => {
    if (!formData.name) return;
    const assetToSave: Asset = {
      id: initialData?.id || Date.now().toString(),
      name: formData.name,
      type: formData.type as AssetType,
      balance: Number(formData.balance),
      currency: formData.currency || 'KRW',
      description: formData.description,
    };

    if (formData.type === AssetType.CREDIT_CARD) {
      assetToSave.creditDetails = creditForm as CreditCardDetails;
      assetToSave.limit = Number(creditForm.limit);
      if (assetToSave.balance > 0) assetToSave.balance = -assetToSave.balance;
    } else if (formData.type === AssetType.LOAN) {
      assetToSave.loanDetails = loanForm as LoanDetails;
      if (assetToSave.balance > 0) assetToSave.balance = -assetToSave.balance;
    } else {
      assetToSave.interestRate = formData.interestRate;
    }

    onSave(assetToSave);
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 flex flex-col h-full animate-in zoom-in-95 duration-300 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-xl text-slate-800">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h3>
        <button onClick={onCancel} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">✕</button>
      </div>

      <div className="space-y-5 pb-6">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Type & Name</label>
          <div className="flex gap-2 mt-1">
            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as AssetType })} className="w-1/3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
              {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Main Chase" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">
            {formData.type === AssetType.CREDIT_CARD ? 'Initial Debt (기존 잔액)' : formData.type === AssetType.LOAN ? 'Current Principal Remaining' : 'Current Balance'}
          </label>
          <div className="relative mt-1">
            <span className="absolute left-4 top-3.5 text-slate-400 font-bold">₩</span>
            <input type="number"
              value={formData.type === AssetType.LOAN ? Math.abs(formData.balance || 0) : formData.balance}
              onChange={e => setFormData({ ...formData, balance: formData.type === AssetType.LOAN ? -Number(e.target.value) : Number(e.target.value) })}
              disabled={isEditing && formData.type === AssetType.CREDIT_CARD}
              className={`w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 ${isEditing && formData.type === AssetType.CREDIT_CARD ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
            />
          </div>
        </div>

        {formData.type === AssetType.CREDIT_CARD && (
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 space-y-4">
            <h4 className="text-sm font-bold text-rose-700 flex items-center gap-2"><span>💳</span> Credit Configuration</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-destructive uppercase">Limit</label>
                <input type="number" value={creditForm.limit} onChange={e => setCreditForm({ ...creditForm, limit: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-rose-200 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-destructive uppercase">APR %</label>
                <input type="number" value={creditForm.apr} onChange={e => setCreditForm({ ...creditForm, apr: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-rose-200 text-sm" />
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-rose-100">
              <p className="text-xs font-bold text-slate-500 mb-2">Billing Cycle</p>
              <div className="flex items-center gap-2 text-sm">
                <span>Usage:</span>
                <input type="number" min="1" max="31" value={creditForm.billingCycle?.usageStartDay} onChange={e => setCreditForm({ ...creditForm, billingCycle: { ...creditForm.billingCycle!, usageStartDay: Number(e.target.value) } })} className="w-12 p-1 border rounded text-center" />
                <span>st ~ End of Month</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-2">
                <span>Pays on:</span>
                <input type="number" min="1" max="31" value={creditForm.billingCycle?.paymentDay} onChange={e => setCreditForm({ ...creditForm, billingCycle: { ...creditForm.billingCycle!, paymentDay: Number(e.target.value) } })} className="w-12 p-1 border rounded text-center bg-rose-50 font-bold" />
                <span>th next month</span>
              </div>
            </div>
          </div>
        )}

        {formData.type === AssetType.LOAN && (
          <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><span>🏦</span> Loan Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Principal</label>
                <input type="number" value={loanForm.principal} onChange={e => setLoanForm({ ...loanForm, principal: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Rate %</label>
                <input type="number" value={loanForm.interestRate} onChange={e => setLoanForm({ ...loanForm, interestRate: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Start Date</label>
                <input type="date" value={loanForm.startDate} onChange={e => setLoanForm({ ...loanForm, startDate: e.target.value })} className="w-full p-2 bg-white rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Term (Mo)</label>
                <input type="number" value={loanForm.termMonths} onChange={e => setLoanForm({ ...loanForm, termMonths: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-slate-300 text-sm" />
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 mt-auto">
          <Button onClick={handleSubmit} className="w-full">Save Asset</Button>
        </div>
      </div>
    </div>
  );
};

// --- Asset Detail Modal (Preserved) ---
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
  useModalClose(true, onClose, modalRef);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div ref={modalRef} className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-5">
        <div className={`p-6 ${theme.bg} text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-10 opacity-10 text-9xl transform translate-x-10 -translate-y-10 pointer-events-none">{theme.icon}</div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="opacity-80 font-medium tracking-wide uppercase text-sm mb-1">{asset.type.replace('_', ' ')}</p>
              <h2 className="text-3xl font-bold mb-2">{asset.name}</h2>
              <h1 className="text-4xl font-extrabold tracking-tight">{asset.balance.toLocaleString()} <span className="text-lg opacity-70 font-normal">KRW</span></h1>
            </div>
            <button onClick={onClose} className="bg-white/20 hover:bg-white/30 p-2 rounded-full text-white backdrop-blur-md transition-all">✕</button>
          </div>
        </div>

        {(asset.type === AssetType.LOAN || asset.type === AssetType.CREDIT_CARD) && (
          <div className="flex border-b border-slate-100">
            <button onClick={() => setActiveTab('overview')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'overview' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>Overview</button>
            {asset.type === AssetType.LOAN && <button onClick={() => setActiveTab('simulation')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'simulation' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>Payoff Plan</button>}
            {asset.type === AssetType.CREDIT_CARD && <button onClick={() => setActiveTab('installments')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'installments' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>Installments</button>}
          </div>
        )}

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
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

              <div className="h-48 w-full">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><span>📉</span> Balance Trend (30 Days)</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
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
                  const txDate = new Date(tx.date);
                  const today = new Date();
                  const monthDiff = (today.getFullYear() - txDate.getFullYear()) * 12 + (today.getMonth() - txDate.getMonth());
                  const current = Math.min(tx.installment.totalMonths, Math.max(1, monthDiff + 1));
                  const percent = (current / tx.installment.totalMonths) * 100;

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
                          <span className="text-blue-600">{current} / {tx.installment.totalMonths} Month</span>
                          <span className="text-slate-400">{Math.round(percent)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          {asset.type === AssetType.CREDIT_CARD && onPay && (
            <Button onClick={() => onPay(asset)} variant="secondary" className="flex-1">💸 Pay Bill</Button>
          )}
          <Button onClick={onEdit} variant="outline" className="flex-1">Edit Details</Button>
          <Button onClick={onDelete} variant="destructive" className="px-6">Delete Asset</Button>
        </div>
      </div>
    </div>
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
          <p className="text-2xl font-black tracking-tight">{asset.balance.toLocaleString()}</p>
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

// --- Main Asset Manager ---
type AssetTab = 'all' | 'bank' | 'card' | 'loan' | 'other' | 'tools';

const AssetManager: React.FC<AssetManagerProps> = ({ assets, transactions, onAddAsset, onUpdateAsset, onDeleteAsset, onPay }) => {
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

  const handleSave = (asset: Asset) => {
    if (isEditing) onUpdateAsset(asset);
    else onAddAsset(asset);
    setShowForm(false);
    setIsEditing(false);
    setSelectedAsset(null);
  };

  const handleDelete = () => {
    if (selectedAsset) {
      onDeleteAsset(selectedAsset.id);
      setSelectedAsset(null);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
        {(['all', 'bank', 'card', 'loan', 'other', 'tools'] as AssetTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all ${activeTab === tab
              ? 'bg-primary text-white shadow-lg scale-105'
              : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
              }`}
          >
            {tab}
          </button>
        ))}
        <button
          onClick={() => { setSelectedAsset(null); setIsEditing(false); setShowForm(true); }}
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-lg transition-transform active:scale-90 flex-shrink-0"
        >
          ➕
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar pr-2">
        {activeTab === 'all' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Net Worth Summary */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl mb-8">
              <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-1">Total Net Worth</p>
              <h1 className="text-4xl font-black">{assets.reduce((sum, a) => sum + a.balance, 0).toLocaleString()} <span className="text-lg font-normal opacity-50">KRW</span></h1>
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
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg h-[80vh]" onClick={e => e.stopPropagation()}>
            <AssetForm initialData={selectedAsset || undefined} isEditing={isEditing} onSave={handleSave} onCancel={() => { setShowForm(false); setIsEditing(false); }} />
          </div>
        </div>
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

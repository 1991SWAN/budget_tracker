import React, { useState, useMemo } from 'react';
import { Asset, AssetType, Transaction, TransactionType } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

interface AssetManagerProps {
  assets: Asset[];
  transactions: Transaction[];
  onAdd: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

// Premium Gradients for Cards
const ASSET_THEMES: Record<AssetType, { bg: string, text: string, icon: string, border: string }> = {
  [AssetType.CASH]: {
    bg: 'bg-gradient-to-br from-emerald-400 to-teal-600',
    text: 'text-white',
    icon: '💵',
    border: 'border-emerald-200'
  },
  [AssetType.CHECKING]: {
    bg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    text: 'text-white',
    icon: '💳',
    border: 'border-blue-200'
  },
  [AssetType.SAVINGS]: {
    bg: 'bg-gradient-to-br from-violet-500 to-purple-700',
    text: 'text-white',
    icon: '🐷',
    border: 'border-purple-200'
  },
  [AssetType.CREDIT_CARD]: {
    bg: 'bg-gradient-to-br from-rose-500 to-pink-600',
    text: 'text-white',
    icon: '💳',
    border: 'border-rose-200'
  },
  [AssetType.INVESTMENT]: {
    bg: 'bg-gradient-to-br from-amber-400 to-orange-600',
    text: 'text-white',
    icon: '📈',
    border: 'border-orange-200'
  },
};

// --- Asset Form (Existing logic, styled up) ---
interface AssetFormProps {
  initialData?: Partial<Asset>;
  onSave: (asset: Asset) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const AssetForm: React.FC<AssetFormProps> = ({ initialData, onSave, onCancel, isEditing = false }) => {
  const [formData, setFormData] = useState<Partial<Asset>>({
    name: '', type: AssetType.CHECKING, balance: 0, currency: 'KRW', description: '', limit: 0, interestRate: 0, billingDay: 14, paymentDay: 25, apr: 15.5, ...initialData
  });

  const handleSubmit = () => {
    if (!formData.name) return;
    const assetToSave: Asset = {
      id: initialData?.id || Date.now().toString(),
      name: formData.name,
      type: formData.type as AssetType,
      balance: formData.type === AssetType.CREDIT_CARD ? (formData.balance || 0) : Number(formData.balance),
      currency: formData.currency || 'KRW',
      description: formData.description,
    };
    if (formData.type === AssetType.CREDIT_CARD) {
      assetToSave.limit = Number(formData.limit);
      assetToSave.billingDay = Number(formData.billingDay); assetToSave.paymentDay = Number(formData.paymentDay); assetToSave.apr = Number(formData.apr);
    }
    if ([AssetType.SAVINGS, AssetType.INVESTMENT, AssetType.CHECKING].includes(formData.type as AssetType)) assetToSave.interestRate = Number(formData.interestRate);
    onSave(assetToSave);
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 flex flex-col h-full animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-xl text-slate-800">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h3>
        <button onClick={onCancel} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">✕</button>
      </div>
      <div className="space-y-4 flex-1 overflow-y-auto pr-2">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Type & Name</label>
          <div className="flex gap-2 mt-1">
            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as AssetType })} className="w-1/3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
              {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Main Chase" />
          </div>
        </div>

        {formData.type !== AssetType.CREDIT_CARD && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Current Balance</label>
            <div className="relative mt-1">
              <span className="absolute left-4 top-3.5 text-slate-400 font-bold">₩</span>
              <input type="number" value={formData.balance} onChange={e => setFormData({ ...formData, balance: Number(e.target.value) })} className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
          <input type="text" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full p-2 bg-transparent border-b border-slate-200 text-sm outline-none focus:border-blue-500 placeholder:text-slate-400" placeholder="Add a note (optional)" />

          {formData.type === AssetType.CREDIT_CARD && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div><label className="text-[10px] font-bold text-rose-500 uppercase">Limit</label><input type="number" value={formData.limit} onChange={e => setFormData({ ...formData, limit: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-rose-100 text-sm" /></div>
              <div><label className="text-[10px] font-bold text-rose-500 uppercase">APR %</label><input type="number" value={formData.apr} onChange={e => setFormData({ ...formData, apr: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-rose-100 text-sm" /></div>
              <div><label className="text-[10px] font-bold text-rose-500 uppercase">Billing Day</label><input type="number" min="1" max="31" value={formData.billingDay} onChange={e => setFormData({ ...formData, billingDay: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-rose-100 text-sm" /></div>
              <div><label className="text-[10px] font-bold text-rose-500 uppercase">Payment Day</label><input type="number" min="1" max="31" value={formData.paymentDay} onChange={e => setFormData({ ...formData, paymentDay: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-rose-100 text-sm" /></div>
            </div>
          )}

          {[AssetType.SAVINGS, AssetType.INVESTMENT, AssetType.CHECKING].includes(formData.type as AssetType) && (
            <div>
              <label className="text-[10px] font-bold text-emerald-600 uppercase">{formData.type === AssetType.INVESTMENT ? 'Return Rate %' : 'Annual Interest %'}</label>
              <input type="number" step="0.1" value={formData.interestRate} onChange={e => setFormData({ ...formData, interestRate: Number(e.target.value) })} className="w-full p-2 mt-1 bg-white border border-emerald-100 rounded-lg text-sm outline-none focus:border-emerald-500" />
            </div>
          )}
        </div>
      </div>
      <div className="pt-4 mt-auto">
        <button onClick={handleSubmit} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">Save Asset</button>
      </div>
    </div>
  );
};

// --- Detailed Analytics Modal ---
const AssetDetailModal: React.FC<{ asset: Asset, transactions: Transaction[], onClose: () => void, onEdit: () => void, onDelete: () => void }> = ({ asset, transactions, onClose, onEdit, onDelete }) => {
  // Generate Chart Data
  const chartData = useMemo(() => {
    const relevantTxs = transactions
      .filter(t => t.assetId === asset.id || t.toAssetId === asset.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = asset.balance;
    // The current balance is the END state. We need to work backwards or simulate forwards?
    // Simulating forwards is better if we have an initial balance, but we don't.
    // Work backwards from current balance.

    const history: { date: string, balance: number }[] = [];
    // Add "Today"
    history.push({ date: new Date().toISOString().split('T')[0], balance: asset.balance });

    // Reverse iterate to build history backwards
    [...relevantTxs].reverse().forEach(tx => {
      const isIncoming = (tx.type === TransactionType.INCOME) || (tx.type === TransactionType.TRANSFER && tx.toAssetId === asset.id);
      const amount = tx.amount;
      // If it was Income recently, balance was LOWER before.
      // If it was Expense recently, balance was HIGHER before.
      if (isIncoming) runningBalance -= amount;
      else runningBalance += amount;

      history.push({ date: tx.date, balance: runningBalance });
    });

    // Limit points and reverse back to chronological
    return history.slice(0, 30).reverse();
  }, [asset, transactions]);

  const recentActivity = useMemo(() => {
    return transactions
      .filter(t => t.assetId === asset.id || t.toAssetId === asset.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // DESC
      .slice(0, 10);
  }, [asset, transactions]);

  const theme = ASSET_THEMES[asset.type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-5">
        {/* Header */}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          {/* Chart */}
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

          {/* Stats & Info */}
          <div className="grid grid-cols-2 gap-4">
            {asset.type === AssetType.CREDIT_CARD && (
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <p className="text-xs text-rose-500 font-bold uppercase mb-1">Credit Limit</p>
                <p className="font-bold text-slate-800">{asset.limit?.toLocaleString()}</p>
                <div className="w-full bg-rose-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-rose-500 h-full" style={{ width: `${Math.min((Math.abs(asset.balance) / (asset.limit || 1)) * 100, 100)}%` }}></div>
                </div>
              </div>
            )}
            {asset.interestRate && asset.interestRate > 0 && (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-xs text-emerald-600 font-bold uppercase mb-1">Interest Rate</p>
                <p className="font-bold text-slate-800 text-lg">{asset.interestRate}%</p>
              </div>
            )}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
              <p className="text-xs text-slate-400 font-bold uppercase mb-1">Note</p>
              <p className="text-slate-600 text-sm">{asset.description || 'No description provided.'}</p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div>
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><span>🧾</span> Recent Activity</h4>
            <div className="space-y-3">
              {recentActivity.length === 0 && <p className="text-center text-slate-400 py-4">No recent transactions.</p>}
              {recentActivity.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${t.type === TransactionType.INCOME ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      {t.emoji || '📄'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{t.memo}</p>
                      <p className="text-xs text-slate-500">{t.date}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${t.type === TransactionType.INCOME ? 'text-emerald-600' : t.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-blue-600'}`}>
                    {t.type === TransactionType.INCOME ? '+' : t.type === TransactionType.EXPENSE ? '-' : ''}{t.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button onClick={onEdit} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">Edit Details</button>
          <button onClick={onDelete} className="px-6 py-3 bg-rose-100 text-rose-600 font-bold rounded-xl hover:bg-rose-200 transition-colors">Delete Asset</button>
        </div>
      </div>
    </div>
  );
};

const AssetManager: React.FC<AssetManagerProps> = ({ assets, transactions, onAdd, onEdit, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null); // For Detail Modal
  const [isAdding, setIsAdding] = useState(false);

  // Group Assets
  const groupedAssets = useMemo(() => {
    const groups = {
      cash: assets.filter(a => [AssetType.CASH, AssetType.CHECKING, AssetType.SAVINGS].includes(a.type)),
      credit: assets.filter(a => [AssetType.CREDIT_CARD].includes(a.type)),
      investment: assets.filter(a => [AssetType.INVESTMENT].includes(a.type))
    };
    return groups;
  }, [assets]);

  const AssetCard = ({ asset }: { asset: Asset }) => {
    const theme = ASSET_THEMES[asset.type];
    const debt = asset.balance < 0 ? Math.abs(asset.balance) : 0;
    const utilization = asset.limit ? Math.min((debt / asset.limit) * 100, 100) : 0;

    return (
      <div onClick={() => setViewingId(asset.id)} className={`group relative h-48 rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${theme.bg} text-white shadow-lg`}>
        {/* Decorative Circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-5 rounded-full blur-2xl"></div>

        <div className="p-6 h-full flex flex-col justify-between relative z-10">
          <div className="flex justify-between items-start">
            <div className="bg-white/20 backdrop-blur-md p-2.5 rounded-xl text-2xl shadow-inner border border-white/10">
              {theme.icon}
            </div>
            {/* Glass Badge */}
            <span className="px-3 py-1 rounded-full bg-black/20 backdrop-blur-md text-[10px] font-bold tracking-widest uppercase border border-white/10">
              {asset.type.replace('_', ' ')}
            </span>
          </div>

          <div>
            <p className="opacity-90 font-medium text-sm mb-1 truncate">{asset.name}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">
                {asset.type === AssetType.CREDIT_CARD ? debt.toLocaleString() : asset.balance.toLocaleString()}
              </span>
              <span className="text-sm opacity-70 font-medium">{asset.currency}</span>
            </div>

            {/* Credit Card Bar */}
            {asset.type === AssetType.CREDIT_CARD && asset.limit && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] opacity-80 mb-1">
                  <span>Usage {Math.round(utilization)}%</span>
                  <span>Limit {asset.limit.toLocaleString()}</span>
                </div>
                <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-white h-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${utilization}%` }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-end gap-4 animate-in fade-in slide-in-from-top-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Portfolio</h1>
          <p className="text-slate-500 mt-1">Total Net Worth: <span className="text-slate-900 font-bold">{assets.reduce((sum, a) => sum + a.balance, 0).toLocaleString()} KRW</span></p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2">
          <span>＋</span> New Asset
        </button>
      </div>

      {/* Grouped Sections */}
      <div className="space-y-10">
        {/* Main Accounts */}
        {groupedAssets.cash.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><span>👛</span> Accounts & Cash</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedAssets.cash.map(a => <AssetCard key={a.id} asset={a} />)}
            </div>
          </section>
        )}

        {/* Credit & Checking together? Or Credit specific */}
        {groupedAssets.credit.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><span>💳</span> Credit Cards & Loans</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedAssets.credit.map(a => <AssetCard key={a.id} asset={a} />)}
            </div>
          </section>
        )}

        {groupedAssets.investment.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><span>📈</span> Investments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedAssets.investment.map(a => <AssetCard key={a.id} asset={a} />)}
            </div>
          </section>
        )}

        {assets.length === 0 && !isAdding && (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">No assets found. Add your first account!</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {(isAdding || editingId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md h-[600px]">
            <AssetForm
              initialData={editingId ? assets.find(a => a.id === editingId) : undefined}
              isEditing={!!editingId}
              onSave={(a) => {
                if (editingId) onEdit(a); else onAdd(a);
                setEditingId(null); setIsAdding(false);
              }}
              onCancel={() => { setEditingId(null); setIsAdding(false); }}
            />
          </div>
        </div>
      )}

      {viewingId && (
        <AssetDetailModal
          asset={assets.find(a => a.id === viewingId)!}
          transactions={transactions}
          onClose={() => setViewingId(null)}
          onEdit={() => { setEditingId(viewingId); setViewingId(null); }}
          onDelete={() => { onDelete(viewingId); setViewingId(null); }}
        />
      )}
    </div>
  );
};

export default AssetManager;

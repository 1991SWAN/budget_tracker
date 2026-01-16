import React, { useState, useMemo, useEffect } from 'react';
import { Asset, AssetType, Transaction } from '../types';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { AssetForm } from './assets/AssetForm';
import { AssetCard } from './assets/AssetCard';
import { AssetDetailModal } from './assets/AssetDetailModal';

// --- Main Asset Manager ---
type AssetTab = 'ALL' | AssetType;
type SortOption = 'default' | 'balance-desc' | 'balance-asc' | 'name-asc';
type GroupOption = 'none' | 'institution' | 'type';

interface AssetManagerProps {
  assets: Asset[];
  transactions: Transaction[];
  onAdd: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (assetId: string) => void;
  onPay?: (asset: Asset) => void;
  onClearHistory?: (assetId: string) => void;
}

const AssetManager: React.FC<AssetManagerProps> = ({ assets, transactions, onAdd, onEdit, onDelete, onPay, onClearHistory }) => {
  const [activeTab, setActiveTab] = useState<AssetTab>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // --- Reactive Asset Sync ---
  // Ensure the open modal (local state) stays in sync with global props
  useEffect(() => {
    if (selectedAsset) {
      const freshAsset = assets.find(a => a.id === selectedAsset.id);
      // Valid update: Asset exists in global state but differs from local snapshot
      if (freshAsset && freshAsset !== selectedAsset) {
        setSelectedAsset(freshAsset);
      }
      // Edge case: Asset was deleted globally? Close modal
      else if (!freshAsset) {
        setSelectedAsset(null);
      }
    }
  }, [assets, selectedAsset]);

  // View Options State
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [groupBy, setGroupBy] = useState<GroupOption>('none');
  const [showViewOptions, setShowViewOptions] = useState(false);

  // Helper to get assets for current tab & Sort
  const displayAssets = useMemo(() => {
    // 1. Filter
    let result = activeTab === 'ALL' ? assets : assets.filter(a => a.type === activeTab);

    // 2. Sort
    switch (sortBy) {
      case 'balance-desc': return [...result].sort((a, b) => b.balance - a.balance);
      case 'balance-asc': return [...result].sort((a, b) => a.balance - b.balance);
      case 'name-asc': return [...result].sort((a, b) => a.name.localeCompare(b.name));
      default: return result;
    }
  }, [assets, activeTab, sortBy]);

  // Grouping Helper
  const renderAssets = () => {
    if (displayAssets.length === 0) {
      return (
        <div className="col-span-full py-12 text-center text-slate-400 italic">
          No assets found in this category.
        </div>
      );
    }

    if (groupBy === 'none') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayAssets.map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
        </div>
      );
    }

    // Grouping Logic
    const groups: Record<string, Asset[]> = {};
    displayAssets.forEach(asset => {
      let key = 'Other';
      if (groupBy === 'institution') key = asset.institution || 'Other';
      else if (groupBy === 'type') key = asset.type.replace('_', ' ');

      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    });

    return (
      <div className="space-y-8">
        {Object.entries(groups).map(([groupName, groupAssets]) => (
          <div key={groupName}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1 pl-2 border-l-2 border-slate-200">
              {groupName} <span className="text-[10px] opacity-50 ml-1">({groupAssets.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupAssets.map(a => <AssetCard key={a.id} asset={a} transactions={transactions} onClick={() => setSelectedAsset(a)} />)}
            </div>
          </div>
        ))}
      </div>
    );
  };

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

  // Define Tabs Order
  const TABS: { id: AssetTab, label: string }[] = [
    { id: 'ALL', label: 'All Assets' },
    { id: AssetType.CHECKING, label: 'Checking' },
    { id: AssetType.SAVINGS, label: 'Savings' },
    { id: AssetType.CREDIT_CARD, label: 'Credit Cards' },
    { id: AssetType.INVESTMENT, label: 'Investments' },
    { id: AssetType.LOAN, label: 'Loans' },
    { id: AssetType.CASH, label: 'Cash' },
  ];

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

      {/* Header Tabs & View Options */}
      <div className="flex items-center justify-between gap-2 mb-4 pr-1">
        <div className="flex items-center gap-2 p-2 overflow-x-auto no-scrollbar flex-1">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant={isActive ? 'primary' : 'ghost'}
                className={`px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all flex-shrink-0 ${isActive
                  ? 'shadow-md scale-105'
                  : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                  }`}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Vertical Divider */}
        <div className="w-px h-8 bg-slate-200 mx-1 hidden md:block"></div>

        {/* View Options Button (Sort & Group) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowViewOptions(!showViewOptions)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${showViewOptions ? 'bg-slate-900 text-white shadow-md transform scale-105' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
              <path d="m21 16-4 4-4-4" />
              <path d="M17 20V4" />
              <path d="m3 8 4-4 4 4" />
              <path d="M7 4v16" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showViewOptions && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 origin-top-right">
              {/* Sort Section */}
              <div className="mb-2">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sort By</div>
                <button onClick={() => { setSortBy('default'); setShowViewOptions(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center ${sortBy === 'default' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Default
                  {sortBy === 'default' && <span>✓</span>}
                </button>
                <button onClick={() => { setSortBy('balance-desc'); setShowViewOptions(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center ${sortBy === 'balance-desc' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Highest Balance
                  {sortBy === 'balance-desc' && <span>✓</span>}
                </button>
                <button onClick={() => { setSortBy('balance-asc'); setShowViewOptions(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center ${sortBy === 'balance-asc' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Lowest Balance
                  {sortBy === 'balance-asc' && <span>✓</span>}
                </button>
                <button onClick={() => { setSortBy('name-asc'); setShowViewOptions(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center ${sortBy === 'name-asc' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Name (A-Z)
                  {sortBy === 'name-asc' && <span>✓</span>}
                </button>
              </div>

              <div className="h-px bg-slate-100 my-1 mx-2"></div>

              {/* Group Section */}
              <div>
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group By</div>
                <button onClick={() => { setGroupBy('none'); setShowViewOptions(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center ${groupBy === 'none' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
                  None
                  {groupBy === 'none' && <span>✓</span>}
                </button>
                <button onClick={() => { setGroupBy('institution'); setShowViewOptions(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center ${groupBy === 'institution' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Institution
                  {groupBy === 'institution' && <span>✓</span>}
                </button>
                <button onClick={() => { setGroupBy('type'); setShowViewOptions(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center ${groupBy === 'type' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Asset Type
                  {groupBy === 'type' && <span>✓</span>}
                </button>
              </div>
            </div>
          )}
        </div>
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
      <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar p-4">
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Show Net Worth Summary only on ALL tab */}
          {activeTab === 'ALL' && (
            <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-3xl p-6 text-white shadow-xl mb-8">
              <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-1">Total Net Worth</p>
              <h1 className="text-4xl font-black">{assets.filter(a => !a.excludeFromTotal).reduce((sum, a) => sum + a.balance, 0).toLocaleString()} <span className="text-lg font-normal opacity-50">KRW</span></h1>
            </div>
          )}

          {/* Asset Renderer (Grid or Groups) */}
          {renderAssets()}
        </div>
      </div>

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
          onClearHistory={onClearHistory}
        />
      )}
    </div>
  );
};

export default AssetManager;

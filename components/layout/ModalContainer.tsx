import React from 'react';
import { Category, BillType, AssetType, Transaction, RecurringTransaction, SavingsGoal, Asset, CategoryItem } from '../../types';
import { SupabaseService } from '../../services/supabaseService';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ModalContainerProps {
    modalType: string | null;
    selectedItem: any;
    formData: any;
    setFormData: (data: any) => void;
    paymentAsset: string;
    setPaymentAsset: (assetId: string) => void;
    destinationAsset: string;
    setDestinationAsset: (assetId: string) => void;
    paymentError: string | null;
    closeModal: () => void;
    handleSubmit: () => void;
    assets: Asset[];
    setRecurring: React.Dispatch<React.SetStateAction<RecurringTransaction[]>>;
    setGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>;
    modalRef: React.RefObject<HTMLDivElement | null>;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({
    modalType,
    selectedItem,
    formData,
    setFormData,
    paymentAsset,
    setPaymentAsset,
    destinationAsset,
    setDestinationAsset,
    paymentError,
    closeModal,
    handleSubmit,
    assets,
    setRecurring,
    setGoals,
    modalRef
}) => {
    if (!modalType || modalType === 'import') return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div ref={modalRef} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">
                        {modalType === 'bill' ? (selectedItem ? 'Edit Bill' : 'Add New Bill') :
                            modalType === 'goal' ? (selectedItem ? 'Edit Goal' : 'Add New Goal') :
                                modalType === 'pay-bill' ? `Pay: ${selectedItem?.name}` :
                                    modalType === 'budget' ? 'Set Monthly Budget' :
                                        modalType === 'pay-card' ? `Pay Off Card: ${selectedItem?.name}` :
                                            modalType === 'import' ? 'Import Transactions' :
                                                `Add Funds: ${selectedItem?.name}`}
                    </h3>
                </div>
                <div className="space-y-4">
                    {modalType === 'bill' && (
                        <>
                            <input type="text" placeholder="Bill Name" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border rounded-lg" />
                            <input type="number" placeholder="Amount" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-2 border rounded-lg" />
                            <div className="flex gap-2">
                                <select value={formData.category || Category.UTILITIES} onChange={e => setFormData({ ...formData, category: e.target.value })} className="flex-1 p-2 border rounded-lg">
                                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select value={formData.billType || BillType.SUBSCRIPTION} onChange={e => setFormData({ ...formData, billType: e.target.value })} className="flex-1 p-2 border rounded-lg">
                                    {Object.values(BillType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Group (e.g. Housing)" value={formData.groupName || ''} onChange={e => setFormData({ ...formData, groupName: e.target.value })} className="flex-1 p-2 border rounded-lg" />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500 whitespace-nowrap">Day:</span>
                                    <input type="number" min="1" max="31" value={formData.dayOfMonth || 1} onChange={e => setFormData({ ...formData, dayOfMonth: e.target.value })} className="w-16 p-2 border rounded-lg" />
                                </div>
                            </div>
                        </>
                    )}
                    {modalType === 'pay-card' && (
                        <>
                            <p className="text-sm text-slate-500 mb-2">Pay off your credit card debt from another account.</p>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Date</label>
                                    <input type="date" value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Category</label>
                                    <select value={formData.category || Category.TRANSFER} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full p-2 border rounded-lg text-sm">
                                        {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Amount</label>
                                <input type="number" placeholder="Payment Amount" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-4 border border-rose-200 bg-rose-50 rounded-xl font-bold text-2xl text-rose-900 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Withdraw From</label>
                                <select value={paymentAsset} onChange={e => setPaymentAsset(e.target.value)} className="w-full p-2 border rounded-lg">
                                    {assets.filter(a => a.type !== AssetType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.institution ? `${a.institution} ${a.name}` : a.name} ({a.balance.toLocaleString()})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Memo / Description</label>
                                <input type="text" placeholder="Memo" value={formData.memo || ''} onChange={e => setFormData({ ...formData, memo: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                            </div>
                        </>
                    )}
                    {modalType === 'goal' && (
                        <>
                            <input type="text" placeholder="Goal Name" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border rounded-lg" />
                            <input type="number" placeholder="Target Amount" value={formData.targetAmount || ''} onChange={e => setFormData({ ...formData, targetAmount: e.target.value })} className="w-full p-2 border rounded-lg" />
                            <div className="flex gap-2">
                                <input type="text" placeholder="Emoji" value={formData.emoji || '🎯'} onChange={e => setFormData({ ...formData, emoji: e.target.value })} className="w-20 p-2 border rounded-lg" />
                                <input type="date" value={formData.deadline || ''} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="flex-1 p-2 border rounded-lg" />
                            </div>
                        </>
                    )}
                    {modalType === 'budget' && (
                        <>
                            <p className="text-sm text-slate-500 mb-2">Set your total monthly budget or expected income.</p>
                            <input type="number" placeholder="e.g. 3,000,000" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-4 border border-blue-200 bg-blue-50 rounded-xl font-bold text-2xl text-blue-900 focus:outline-none" autoFocus />
                        </>
                    )}
                    {(modalType === 'pay-bill' || modalType === 'fund-goal') && (
                        <>
                            {modalType === 'fund-goal' && <input type="number" placeholder="Amount to Add" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-2 border rounded-lg font-bold text-lg" autoFocus />}
                            <label className="block text-xs font-semibold text-slate-500 uppercase">Pay From / Source</label>
                            <select value={paymentAsset} onChange={e => setPaymentAsset(e.target.value)} className="w-full p-2 border rounded-lg">
                                {assets.filter(a => a.type !== AssetType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.institution ? `${a.institution} ${a.name}` : a.name} ({a.balance.toLocaleString()})</option>)}
                            </select>
                            {modalType === 'fund-goal' && (
                                <>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mt-2">To Account (Optional)</label>
                                    <select value={destinationAsset} onChange={e => setDestinationAsset(e.target.value)} className="w-full p-2 border rounded-lg">
                                        <option value="">None (Track Only)</option>
                                        {assets.map(a => <option key={a.id} value={a.id} disabled={a.id === paymentAsset}>{a.institution ? `${a.institution} ${a.name}` : a.name} ({a.type})</option>)}
                                    </select>
                                </>
                            )}
                        </>
                    )}

                    {paymentError && (
                        <div className="bg-rose-50 text-destructive p-2 rounded-lg text-xs font-bold border border-rose-100 flex items-center gap-2">
                            <AlertTriangle size={14} /> {paymentError}
                        </div>
                    )}

                    {modalType !== 'import' && (
                        <div className="flex gap-2 pt-4">
                            {(modalType === 'bill' || modalType === 'goal') && selectedItem && (
                                <button
                                    onClick={() => {
                                        if (modalType === 'bill') {
                                            SupabaseService.deleteRecurring(selectedItem.id);
                                            setRecurring(prev => prev.filter(r => r.id !== selectedItem.id));
                                        }
                                        if (modalType === 'goal') {
                                            SupabaseService.deleteGoal(selectedItem.id);
                                            setGoals(prev => prev.filter(g => g.id !== selectedItem.id));
                                        }
                                        closeModal();
                                    }}
                                    className="p-2 text-destructive hover:bg-rose-50 rounded-lg mr-auto flex items-center justify-center font-bold"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                            <button onClick={closeModal} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={handleSubmit} className="flex-1 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-700">
                                {modalType === 'pay-bill' || modalType === 'pay-card' ? 'Confirm Payment' : modalType === 'fund-goal' ? 'Add Funds' : 'Save'}
                            </button>
                        </div>
                    )}
                    {modalType === 'import' && (
                        <div className="pt-2 text-center">
                            <button onClick={closeModal} className="text-sm text-slate-400 hover:text-slate-600">Cancel Import</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

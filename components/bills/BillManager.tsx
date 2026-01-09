import React, { useState, useEffect, useMemo } from 'react';
import { RecurringTransaction, Category, BillType, Asset, AssetType } from '../../types';

interface BillManagerProps {
    recurring: RecurringTransaction[];
    assets: Asset[];
    onRecurringChange: (action: 'add' | 'update' | 'delete' | 'pay', item: any) => void;
}

const BillManager: React.FC<BillManagerProps> = ({ recurring, assets, onRecurringChange }) => {
    // --- Local State for Groups ---
    const [billGroup, setBillGroup] = useState<string>('All');
    const [billGroups, setBillGroups] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('smartpenny_custom_groups');
            const parsed = saved ? JSON.parse(saved) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    });
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [newGroupInput, setNewGroupInput] = useState('');

    // --- Modal State ---
    const [modalType, setModalType] = useState<'edit' | 'pay' | null>(null);
    const [selectedBill, setSelectedBill] = useState<RecurringTransaction | null>(null);

    // Form Data for Edit/Add
    const [formData, setFormData] = useState<{
        name: string;
        amount: string | number;
        category: Category;
        billType: BillType;
        dayOfMonth: number;
        groupName: string;
    }>({
        name: '',
        amount: '',
        category: Category.UTILITIES,
        billType: BillType.SUBSCRIPTION,
        dayOfMonth: 1,
        groupName: ''
    });

    // Form Data for Payment
    const [paymentAssetId, setPaymentAssetId] = useState<string>('');

    // --- Effects ---
    useEffect(() => {
        localStorage.setItem('smartpenny_custom_groups', JSON.stringify(billGroups));
    }, [billGroups]);

    // --- Handlers: Groups ---
    const handleAddGroup = () => {
        if (newGroupInput.trim() && !billGroups.includes(newGroupInput.trim())) {
            const newGroup = newGroupInput.trim();
            setBillGroups([...billGroups, newGroup]);
            setBillGroup(newGroup);
            setNewGroupInput('');
            setIsAddingGroup(false);
        }
    };

    const handleDeleteGroup = (groupToDelete: string) => {
        const updatedGroups = billGroups.filter(g => g !== groupToDelete);
        setBillGroups(updatedGroups);
        if (billGroup === groupToDelete) setBillGroup('All');
    };

    // --- Handlers: Modals ---
    const openAddBill = () => {
        setSelectedBill(null);
        setFormData({
            name: '',
            amount: '',
            category: Category.UTILITIES,
            billType: BillType.SUBSCRIPTION,
            dayOfMonth: 1,
            groupName: billGroup === 'All' ? '' : billGroup
        });
        setModalType('edit');
    };

    const openEditBill = (bill: RecurringTransaction) => {
        setSelectedBill(bill);
        setFormData({
            name: bill.name,
            amount: bill.amount,
            category: bill.category,
            billType: bill.billType || BillType.SUBSCRIPTION,
            dayOfMonth: bill.dayOfMonth,
            groupName: bill.groupName || ''
        });
        setModalType('edit');
    };

    const openPayBill = (bill: RecurringTransaction) => {
        setSelectedBill(bill);
        // Default to first non-credit asset
        const defaultAsset = assets.find(a => a.type !== AssetType.CREDIT_CARD);
        setPaymentAssetId(defaultAsset?.id || '');
        setModalType('pay');
    };

    const closeModal = () => {
        setModalType(null);
        setSelectedBill(null);
    };

    const handleSave = () => {
        if (modalType === 'edit') {
            const action = selectedBill ? 'update' : 'add';
            onRecurringChange(action, {
                id: selectedBill?.id,
                name: formData.name,
                amount: Number(formData.amount),
                dayOfMonth: Number(formData.dayOfMonth),
                category: formData.category,
                billType: formData.billType,
                groupName: formData.groupName
            });
        } else if (modalType === 'pay' && selectedBill) {
            onRecurringChange('pay', {
                id: selectedBill.id,
                name: selectedBill.name,
                amount: selectedBill.amount,
                category: selectedBill.category,
                assetId: paymentAssetId
            });
        }
        closeModal();
    };

    const handleDelete = () => {
        if (selectedBill) {
            onRecurringChange('delete', { id: selectedBill.id });
            closeModal();
        }
    };

    // --- Render Helpers ---
    const today = new Date();
    const sortedBills = useMemo(() => {
        return recurring
            .filter(bill => billGroup === 'All' || (bill.groupName || 'Default') === billGroup)
            .sort((a, b) => {
                const aDiff = a.dayOfMonth - today.getDate();
                const bDiff = b.dayOfMonth - today.getDate();
                if ((aDiff >= 0 && bDiff >= 0) || (aDiff < 0 && bDiff < 0)) return a.dayOfMonth - b.dayOfMonth;
                return aDiff >= 0 ? -1 : 1; // Upcoming first
            });
    }, [recurring, billGroup, today]);

    // --- Render ---
    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-800">
                    <span>📫</span><h3 className="font-bold text-lg">Upcoming Bills</h3>
                </div>
                <button onClick={openAddBill} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-lg hover:bg-indigo-100 transition-colors">➕</button>
            </div>

            {/* Group Tabs */}
            <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 scrollbar-hide items-center relative">
                {['All', ...billGroups].map(group => (
                    <button
                        key={group}
                        onClick={() => setBillGroup(group)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${billGroup === group
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                    >
                        {group}
                        {group !== 'All' && billGroup === group && (
                            <span
                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                                className="ml-1 hover:bg-indigo-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                            >
                                ✕
                            </span>
                        )}
                    </button>
                ))}

                <div className="relative">
                    <button
                        onClick={() => setIsAddingGroup(!isAddingGroup)}
                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center w-8 h-8"
                    >
                        ➕
                    </button>
                    {isAddingGroup && (
                        <div className="absolute top-0 left-full ml-2 bg-white p-2 rounded-xl shadow-xl border border-slate-100 flex items-center gap-2 z-10 w-48 animate-in fade-in zoom-in duration-200 origin-left">
                            <input
                                type="text"
                                autoFocus
                                placeholder="Group Name"
                                value={newGroupInput}
                                onChange={(e) => setNewGroupInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup(); if (e.key === 'Escape') setIsAddingGroup(false); }}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                            />
                            <button onClick={handleAddGroup} className="bg-indigo-600 text-white p-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700">Add</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Bill List */}
            <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin flex-1 min-h-0">
                {sortedBills.length === 0 ? (
                    <div className="text-center text-slate-400 py-10 flex flex-col items-center gap-2">
                        <p>No bills found.</p>
                    </div>
                ) : (
                    sortedBills.map((bill) => (
                        <div key={bill.id} className="flex flex-col p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer group" onClick={() => openEditBill(bill)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg text-xs font-bold ${bill.dayOfMonth === today.getDate() ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                        <span className="text-[9px] uppercase">Day</span>{bill.dayOfMonth}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">{bill.name}</p>
                                        <p className="text-[10px] text-slate-500">{bill.groupName || 'Default'} • {bill.category}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold text-slate-800 block text-sm">{bill.amount.toLocaleString()}</span>
                                    <button onClick={(e) => { e.stopPropagation(); openPayBill(bill); }} className="px-3 py-1 mt-1 bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-md hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">Pay</button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* --- Modals --- */}
            {modalType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeModal}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">
                                {modalType === 'edit' ? (selectedBill ? 'Edit Bill' : 'Add New Bill') : `Pay: ${selectedBill?.name}`}
                            </h3>
                            <button onClick={closeModal} className="text-xl">✖️</button>
                        </div>

                        <div className="space-y-4">
                            {modalType === 'edit' && (
                                <>
                                    <input type="text" placeholder="Bill Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border rounded-lg" />
                                    <input type="number" placeholder="Amount" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-2 border rounded-lg" />
                                    <div className="flex gap-2">
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as Category })} className="flex-1 p-2 border rounded-lg">
                                            {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <select value={formData.billType} onChange={e => setFormData({ ...formData, billType: e.target.value as BillType })} className="flex-1 p-2 border rounded-lg">
                                            {Object.values(BillType).map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Group (e.g. Housing)" value={formData.groupName} onChange={e => setFormData({ ...formData, groupName: e.target.value })} className="flex-1 p-2 border rounded-lg" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-500 whitespace-nowrap">Day:</span>
                                            <input type="number" min="1" max="31" value={formData.dayOfMonth} onChange={e => setFormData({ ...formData, dayOfMonth: Number(e.target.value) })} className="w-16 p-2 border rounded-lg" />
                                        </div>
                                    </div>
                                </>
                            )}

                            {modalType === 'pay' && (
                                <>
                                    <div className="bg-slate-50 p-4 rounded-xl mb-2">
                                        <p className="text-sm font-bold text-slate-700">{selectedBill?.name}</p>
                                        <p className="text-2xl font-bold text-slate-900">{selectedBill?.amount.toLocaleString()} KRW</p>
                                    </div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase">Pay From</label>
                                    <select value={paymentAssetId} onChange={e => setPaymentAssetId(e.target.value)} className="w-full p-2 border rounded-lg">
                                        {assets.filter(a => a.type !== AssetType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toLocaleString()})</option>)}
                                    </select>
                                </>
                            )}

                            <div className="flex gap-2 pt-4">
                                {modalType === 'edit' && selectedBill && (
                                    <button onClick={handleDelete} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg mr-auto text-xl">🗑️</button>
                                )}
                                <button onClick={closeModal} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button onClick={handleSave} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                                    {modalType === 'pay' ? 'Confirm Payment' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillManager;

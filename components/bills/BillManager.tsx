import React, { useState, useEffect, useMemo } from 'react';
import { RecurringTransaction, Category, BillType, Asset, AssetType } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { EmptyState } from '../ui/EmptyState';

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

    return (
        <Card className="flex flex-col h-full bg-surface" padding="lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-primary">
                    <span>📫</span><h3 className="font-bold text-lg">Upcoming Bills</h3>
                </div>
                <Button onClick={openAddBill} size="sm" variant="secondary">➕ Add Bill</Button>
            </div>

            {/* Group Tabs */}
            <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 scrollbar-hide items-center relative">
                {['All', ...billGroups].map(group => (
                    <button
                        key={group}
                        onClick={() => setBillGroup(group)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${billGroup === group
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-100 text-muted hover:bg-slate-200'
                            }`}
                    >
                        {group}
                        {group !== 'All' && billGroup === group && (
                            <span
                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                                className="ml-1 hover:bg-primary/80 rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
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
                            <Button onClick={handleAddGroup} size="sm">Add</Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Bill List */}
            <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin flex-1 min-h-0">
                {sortedBills.length === 0 ? (
                    <EmptyState
                        icon="📫"
                        title="No bills found"
                        description="Add your first bill subscription."
                        className="py-10"
                    />
                ) : (
                    sortedBills.map((bill) => (
                        <Card key={bill.id} className="p-3 hover:bg-slate-50 transition-all cursor-pointer group border-slate-100" noPadding onClick={() => openEditBill(bill)}>
                            <div className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg text-xs font-bold ${bill.dayOfMonth === today.getDate() ? 'bg-destructive/10 text-destructive' : 'bg-slate-100 text-muted'}`}>
                                        <span className="text-[9px] uppercase">Day</span>{bill.dayOfMonth}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-primary">{bill.name}</p>
                                        <p className="text-[10px] text-muted">{bill.groupName || 'Default'} • {bill.category}</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    <span className="font-bold text-primary block text-sm">{bill.amount.toLocaleString()}</span>
                                    <Button onClick={(e) => { e.stopPropagation(); openPayBill(bill); }} size="sm" variant="outline" className="text-[10px] h-7 py-0 px-2">Pay</Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* --- Modals: Refactored to use Dialog & Input --- */}

            {/* Edit/Add Modal */}
            <Dialog
                isOpen={modalType === 'edit'}
                onClose={closeModal}
                title={selectedBill ? 'Edit Bill' : 'Add New Bill'}
                footer={
                    <>
                        {selectedBill && (
                            <Button onClick={handleDelete} variant="destructive" size="icon" className="mr-auto w-10">🗑️</Button>
                        )}
                        <Button onClick={closeModal} variant="ghost">Cancel</Button>
                        <Button onClick={handleSave} variant="primary">Save</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Bill Name"
                        placeholder="e.g. Netflix"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                    <Input
                        label="Amount"
                        type="number"
                        placeholder="0"
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                        leftIcon={<span>₩</span>}
                    />
                    <div className="flex gap-4">
                        <Select
                            label="Category"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
                            options={Object.values(Category).map(c => ({ label: c, value: c }))}
                        />
                        <Select
                            label="Type"
                            value={formData.billType}
                            onChange={e => setFormData({ ...formData, billType: e.target.value as BillType })}
                            options={Object.values(BillType).map(t => ({ label: t, value: t }))}
                        />
                    </div>
                    <div className="flex gap-4">
                        <Input
                            label="Group"
                            placeholder="e.g. Housing"
                            value={formData.groupName}
                            onChange={e => setFormData({ ...formData, groupName: e.target.value })}
                        />
                        <div className="w-24">
                            <Input
                                label="Day"
                                type="number"
                                min={1} max={31}
                                value={formData.dayOfMonth}
                                onChange={e => setFormData({ ...formData, dayOfMonth: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* Pay Modal */}
            <Dialog
                isOpen={modalType === 'pay'}
                onClose={closeModal}
                title={`Pay: ${selectedBill?.name}`}
                footer={
                    <>
                        <Button onClick={closeModal} variant="ghost">Cancel</Button>
                        <Button onClick={handleSave} variant="primary">Confirm Payment</Button>
                    </>
                }
            >
                <div className="bg-slate-50 p-4 rounded-xl mb-4 text-center border border-slate-100">
                    <p className="text-sm font-bold text-muted mb-1">Payment Amount</p>
                    <p className="text-3xl font-bold text-primary">{selectedBill?.amount.toLocaleString()} <span className="text-lg font-normal text-muted">KRW</span></p>
                </div>
                <Select
                    label="Pay From"
                    value={paymentAssetId}
                    onChange={e => setPaymentAssetId(e.target.value)}
                    options={assets
                        .filter(a => a.type !== AssetType.CREDIT_CARD)
                        .map(a => ({ label: `${a.name} (${a.balance.toLocaleString()})`, value: a.id }))}
                />
            </Dialog>
        </Card>
    );
};

export default BillManager;

import React, { useState, useEffect, useMemo } from 'react';
import { RecurringTransaction, Category, BillType, Asset, AssetType } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Mail, Plus, X } from 'lucide-react';

interface BillManagerProps {
    recurring: RecurringTransaction[];
    assets: Asset[];
    onRecurringChange: (action: 'add' | 'update' | 'delete' | 'pay', item: any) => void;
    // New handlers via props
    onEditBill: (bill: RecurringTransaction) => void;
    onPayBill: (bill: RecurringTransaction) => void;
    onAddBill: () => void;
}

const BillManager: React.FC<BillManagerProps> = ({ recurring, assets, onRecurringChange, onEditBill, onPayBill, onAddBill }) => {
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
                    <Mail size={20} />
                    <h3 className="font-bold text-lg">Upcoming Bills</h3>
                </div>
                <Button onClick={onAddBill} size="sm" variant="secondary" className="rounded-2xl gap-2">
                    <Plus size={16} />
                    Add Bill
                </Button>
            </div>

            {/* Group Tabs */}
            <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 scrollbar-hide items-center relative">
                {['All', ...billGroups].map(group => (
                    <button
                        key={group}
                        onClick={() => setBillGroup(group)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${billGroup === group
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-100 text-muted hover:bg-slate-200'
                            }`}
                    >
                        {group}
                        {group !== 'All' && billGroup === group && (
                            <span
                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                                className="ml-1 hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                            >
                                <X size={10} />
                            </span>
                        )}
                    </button>
                ))}

                <div className="relative">
                    <button
                        onClick={() => setIsAddingGroup(!isAddingGroup)}
                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center w-8 h-8 transition-all"
                    >
                        <Plus size={16} />
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
                        icon={<Mail className="w-8 h-8 opacity-20" />}
                        title="No bills found"
                        description="Add your first bill subscription."
                        className="py-10"
                    />
                ) : (
                    sortedBills.map((bill) => (
                        <Card key={bill.id} className="p-3 hover:bg-slate-50 transition-all cursor-pointer group border-slate-100" noPadding onClick={() => onEditBill(bill)}>
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
                                    <Button onClick={(e) => { e.stopPropagation(); onPayBill(bill); }} size="sm" variant="outline" className="text-[10px] h-7 py-0 px-2">Pay</Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
            {/* Note: Modals have been lifted to PlanningTab */}
        </Card>
    );
};

export default BillManager;

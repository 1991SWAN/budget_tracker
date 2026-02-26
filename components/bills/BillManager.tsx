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
    // --- Local State for Filter ---
    const [billFilter, setBillFilter] = useState<BillType | 'All'>('All');

    // --- Render Helpers ---
    const today = new Date();

    const uniquePresentTypes = useMemo(() => {
        const types = new Set<BillType>();
        recurring.forEach(bill => {
            if (bill.billType) types.add(bill.billType);
        });
        return Array.from(types);
    }, [recurring]);

    const sortedBills = useMemo(() => {
        return recurring
            .filter(bill => billFilter === 'All' || bill.billType === billFilter)
            .sort((a, b) => {
                const aDiff = a.dayOfMonth - today.getDate();
                const bDiff = b.dayOfMonth - today.getDate();
                if ((aDiff >= 0 && bDiff >= 0) || (aDiff < 0 && bDiff < 0)) return a.dayOfMonth - b.dayOfMonth;
                return aDiff >= 0 ? -1 : 1; // Upcoming first
            });
    }, [recurring, billFilter, today]);

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

            {/* Type Filter Tabs */}
            {uniquePresentTypes.length > 0 && (
                <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 scrollbar-hide items-center relative">
                    {['All', ...uniquePresentTypes].map(type => (
                        <button
                            key={type}
                            onClick={() => setBillFilter(type as BillType | 'All')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${billFilter === type
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-slate-100 text-muted hover:bg-slate-200'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            )}

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
                                        <p className="text-[10px] text-muted">{bill.category}</p>
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

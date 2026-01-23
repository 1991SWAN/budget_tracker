import React, { useMemo, useState } from 'react';
import { RecurringTransaction, SavingsGoal, Asset, Category, BillType, AssetType } from '../../types';
import BillManager from '../bills/BillManager';
import GoalManager from '../goals/GoalManager';
import SubscriptionView from '../subscription/SubscriptionView';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Trash2 } from 'lucide-react';

interface PlanningTabProps {
    recurring: RecurringTransaction[];
    goals: SavingsGoal[];
    assets: Asset[];
    onRecurringChange: (action: 'add' | 'update' | 'delete' | 'pay', item: any) => void;
    onGoalChange: (action: 'add' | 'update' | 'delete' | 'contribute', item: any) => void;
}

const PlanningTab: React.FC<PlanningTabProps> = ({ recurring, goals, assets, onRecurringChange, onGoalChange }) => {
    const today = new Date();

    // Generate days for the current month for Calendar Strip
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // --- Modal Logic Lifted from BillManager ---
    const [modalType, setModalType] = useState<'edit' | 'pay' | null>(null);
    const [selectedBill, setSelectedBill] = useState<RecurringTransaction | null>(null);

    // Form Data
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

    const [paymentAssetId, setPaymentAssetId] = useState<string>('');

    // --- Handlers ---
    const openAddBill = () => {
        setSelectedBill(null);
        setFormData({
            name: '',
            amount: '',
            category: Category.UTILITIES,
            billType: BillType.SUBSCRIPTION,
            dayOfMonth: 1,
            groupName: ''
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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* 1. Subscription Hub (Calendar & Stats) */}
            <SubscriptionView
                recurring={recurring}
                transactions={[]}
                onEdit={openEditBill}
            />

            {/* 2. Managers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BillManager
                    recurring={recurring}
                    // BillManager mainly just displays lists now, but we want it to trigger OUR modals
                    // So we must update BillManager props to accept onEdit/onAdd overrides, 
                    // OR we pass the logic down.
                    // For now, let's keep it simple: We pass a "custom" props if we refactor BillManager.
                    // But BillManager currently doesn't accept 'onEdit'. 
                    // I will need to update BillManager signature NEXT.
                    // For now, I pass the same 'onRecurringChange' but I will intercept it in BillManager refactor.
                    assets={assets}
                    onRecurringChange={onRecurringChange} // This will be deprecated/refactored in next step

                    // New Props enabling external control (Will be added to BillManager in next step)
                    onEditBill={openEditBill}
                    onPayBill={openPayBill}
                    onAddBill={openAddBill}
                />
                <GoalManager
                    goals={goals}
                    assets={assets}
                    onGoalChange={onGoalChange}
                />
            </div>

            {/* --- Modals Rendered Here --- */}
            <Dialog
                isOpen={modalType === 'edit'}
                onClose={closeModal}
                title={selectedBill ? 'Edit Bill' : 'Add New Bill'}
                footer={
                    <>
                        {selectedBill && (
                            <Button onClick={handleDelete} variant="destructive" size="icon" className="mr-auto w-10">
                                <Trash2 size={18} />
                            </Button>
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

            <Dialog
                isOpen={modalType === 'pay'}
                onClose={closeModal}
                title={`Pay: ${selectedBill?.name} `}
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
        </div>
    );
};

export default PlanningTab;

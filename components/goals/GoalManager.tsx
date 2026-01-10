import React, { useState } from 'react';
import { SavingsGoal, Asset, AssetType, Category, TransactionType } from '../../types';
import { Button } from '../ui/Button';

interface GoalManagerProps {
    goals: SavingsGoal[];
    assets: Asset[];
    onGoalChange: (action: 'add' | 'update' | 'delete' | 'contribute', item: any) => void;
}

const GoalManager: React.FC<GoalManagerProps> = ({ goals, assets, onGoalChange }) => {
    // --- Modal State ---
    const [modalType, setModalType] = useState<'edit' | 'fund' | null>(null);
    const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

    // Form Data
    const [formData, setFormData] = useState<{
        name: string;
        targetAmount: string | number;
        emoji: string;
        deadline: string;
    }>({
        name: '',
        targetAmount: '',
        emoji: '🎯',
        deadline: ''
    });

    // Fund Data
    const [fundAmount, setFundAmount] = useState<string>('');
    const [paymentAssetId, setPaymentAssetId] = useState<string>('');
    const [destinationAssetId, setDestinationAssetId] = useState<string>('');

    // --- Handlers ---
    const openAddGoal = () => {
        setSelectedGoal(null);
        setFormData({ name: '', targetAmount: '', emoji: '🎯', deadline: '' });
        setModalType('edit');
    };

    const openEditGoal = (goal: SavingsGoal) => {
        setSelectedGoal(goal);
        setFormData({
            name: goal.name,
            targetAmount: goal.targetAmount,
            emoji: goal.emoji,
            deadline: goal.deadline || ''
        });
        setModalType('edit');
    };

    const openFundGoal = (goal: SavingsGoal) => {
        setSelectedGoal(goal);
        setFundAmount('');
        const defaultAsset = assets.find(a => a.type !== AssetType.CREDIT_CARD);
        setPaymentAssetId(defaultAsset?.id || '');
        setDestinationAssetId(''); // Optional
        setModalType('fund');
    };

    const closeModal = () => {
        setModalType(null);
        setSelectedGoal(null);
    };

    const handleSave = () => {
        if (modalType === 'edit') {
            const action = selectedGoal ? 'update' : 'add';
            onGoalChange(action, {
                id: selectedGoal?.id,
                name: formData.name,
                targetAmount: Number(formData.targetAmount),
                emoji: formData.emoji,
                deadline: formData.deadline || new Date().toISOString().split('T')[0],
                currentAmount: selectedGoal?.currentAmount || 0
            });
        } else if (modalType === 'fund' && selectedGoal) {
            onGoalChange('contribute', {
                id: selectedGoal.id,
                name: selectedGoal.name,
                amount: Number(fundAmount),
                assetId: paymentAssetId,
                toAssetId: destinationAssetId || undefined
            });
        }
        closeModal();
    };

    const handleDelete = () => {
        if (selectedGoal) {
            onGoalChange('delete', { id: selectedGoal.id });
            closeModal();
        }
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-96 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-800"><span>🎯</span><h3 className="font-bold text-lg">Goals Tracker</h3></div>
                <Button onClick={openAddGoal} size="sm" variant="secondary" className="rounded-2xl">➕ Add Goal</Button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 scrollbar-thin">
                {goals.map((goal) => (
                    <div key={goal.id} className="group p-1">
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEditGoal(goal)}>
                                <span className="text-3xl bg-slate-50 p-2 rounded-xl">{goal.emoji}</span>
                                <div>
                                    <p className="font-bold text-slate-700">{goal.name}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Target: {goal.targetAmount.toLocaleString()} KRW</p>
                                </div>
                            </div>
                            <button onClick={() => openFundGoal(goal)} className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-2xl hover:bg-emerald-100 transition-colors">+ Add Funds</button>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex items-center px-0.5">
                            <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)}%` }}></div>
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-400">
                            <span>{Math.round((goal.currentAmount / goal.targetAmount) * 100)}%</span>
                            <span>{goal.currentAmount.toLocaleString()} / {goal.targetAmount.toLocaleString()}</span>
                        </div>
                    </div>
                ))}
                {goals.length === 0 && <div className="text-center text-slate-400 py-10">No goals set yet.</div>}
            </div>

            {/* --- Modals --- */}
            {modalType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeModal}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">
                                {modalType === 'edit' ? (selectedGoal ? 'Edit Goal' : 'Add New Goal') : `Add Funds: ${selectedGoal?.name}`}
                            </h3>
                            <button onClick={closeModal} className="text-xl">✖️</button>
                        </div>

                        <div className="space-y-4">
                            {modalType === 'edit' && (
                                <>
                                    <input type="text" placeholder="Goal Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border rounded-lg" />
                                    <input type="number" placeholder="Target Amount" value={formData.targetAmount} onChange={e => setFormData({ ...formData, targetAmount: e.target.value })} className="w-full p-2 border rounded-lg" />
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Emoji" value={formData.emoji} onChange={e => setFormData({ ...formData, emoji: e.target.value })} className="w-20 p-2 border rounded-lg" />
                                        <input type="date" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="flex-1 p-2 border rounded-lg" />
                                    </div>
                                </>
                            )}

                            {modalType === 'fund' && (
                                <>
                                    <input type="number" placeholder="Amount to Add" value={fundAmount} onChange={e => setFundAmount(e.target.value)} className="w-full p-2 border rounded-lg font-bold text-lg" autoFocus />
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mt-2">Pay From / Source</label>
                                    <select value={paymentAssetId} onChange={e => setPaymentAssetId(e.target.value)} className="w-full p-2 border rounded-lg">
                                        {assets.filter(a => a.type !== AssetType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toLocaleString()})</option>)}
                                    </select>

                                    <label className="block text-xs font-semibold text-slate-500 uppercase mt-2">To Account (Optional)</label>
                                    <select value={destinationAssetId} onChange={e => setDestinationAssetId(e.target.value)} className="w-full p-2 border rounded-lg">
                                        <option value="">None (Track Only)</option>
                                        {assets.map(a => <option key={a.id} value={a.id} disabled={a.id === paymentAssetId}>{a.name} ({a.type})</option>)}
                                    </select>
                                </>
                            )}

                            <div className="flex gap-2 pt-4">
                                {modalType === 'edit' && selectedGoal && (
                                    <button onClick={handleDelete} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg mr-auto text-xl">🗑️</button>
                                )}
                                <button onClick={closeModal} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button onClick={handleSave} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                                    {modalType === 'fund' ? 'Add Funds' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoalManager;

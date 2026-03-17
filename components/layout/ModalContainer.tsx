import React from 'react';
import { BillType, AssetType, Transaction, RecurringTransaction, SavingsGoal, Asset, CategoryItem } from '../../types';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { getDefaultCategoryId } from '../../utils/category';
import type {
    BillModalForm,
    BudgetModalForm,
    FundGoalModalForm,
    GoalModalForm,
    ModalFormData,
    ModalFormSetter,
    ModalSelectedItem,
    ModalType,
    PayCardModalForm
} from '../../hooks/modalTypes';

export interface ModalContainerProps {
    modalType: ModalType;
    selectedItem: ModalSelectedItem;
    formData: ModalFormData;
    setFormData: ModalFormSetter;
    paymentAsset: string;
    setPaymentAsset: (assetId: string) => void;
    destinationAsset: string;
    setDestinationAsset: (assetId: string) => void;
    paymentError: string | null;
    closeModal: () => void;
    handleSubmit: () => void;
    assets: Asset[];
    categories: CategoryItem[];
    onDeleteSelected: () => Promise<void> | void;
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
    categories,
    onDeleteSelected,
    modalRef
}) => {
    if (!modalType || modalType === 'import') return null;

    const expenseCategories = categories.filter(category => category.type === 'EXPENSE');
    const transferCategories = categories.filter(category => category.type === 'TRANSFER');
    const billForm = modalType === 'bill' ? formData as BillModalForm : null;
    const goalForm = modalType === 'goal' ? formData as GoalModalForm : null;
    const budgetForm = modalType === 'budget' ? formData as BudgetModalForm : null;
    const payCardForm = modalType === 'pay-card' ? formData as PayCardModalForm : null;
    const fundGoalForm = modalType === 'fund-goal' ? formData as FundGoalModalForm : null;
    const selectedBill = (modalType === 'bill' || modalType === 'pay-bill')
        ? selectedItem as RecurringTransaction | null
        : null;
    const selectedGoal = (modalType === 'goal' || modalType === 'fund-goal')
        ? selectedItem as SavingsGoal | null
        : null;
    const selectedAsset = modalType === 'pay-card' ? selectedItem as Asset | null : null;

    const updateBillForm = (patch: Partial<BillModalForm>) => {
        setFormData(previous => ({ ...(previous as BillModalForm), ...patch }));
    };

    const updateGoalForm = (patch: Partial<GoalModalForm>) => {
        setFormData(previous => ({ ...(previous as GoalModalForm), ...patch }));
    };

    const updateBudgetForm = (patch: Partial<BudgetModalForm>) => {
        setFormData(previous => ({ ...(previous as BudgetModalForm), ...patch }));
    };

    const updatePayCardForm = (patch: Partial<PayCardModalForm>) => {
        setFormData(previous => ({ ...(previous as PayCardModalForm), ...patch }));
    };

    const updateFundGoalForm = (patch: Partial<FundGoalModalForm>) => {
        setFormData(previous => ({ ...(previous as FundGoalModalForm), ...patch }));
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div ref={modalRef} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">
                        {modalType === 'bill' ? (selectedBill ? 'Edit Bill' : 'Add New Bill') :
                            modalType === 'goal' ? (selectedGoal ? 'Edit Goal' : 'Add New Goal') :
                                modalType === 'pay-bill' ? `Pay: ${selectedBill?.name}` :
                                    modalType === 'budget' ? 'Set Monthly Budget' :
                                        modalType === 'pay-card' ? `Pay Off Card: ${selectedAsset?.name}` :
                                            modalType === 'import' ? 'Import Transactions' :
                                                `Add Funds: ${selectedGoal?.name}`}
                    </h3>
                </div>
                <div className="space-y-4">
                    {modalType === 'bill' && billForm && (
                        <>
                            <input type="text" placeholder="Bill Name" value={billForm.name || ''} onChange={e => updateBillForm({ name: e.target.value })} className="w-full p-2 border rounded-lg" />
                            <input type="number" placeholder="Amount" value={billForm.amount || ''} onChange={e => updateBillForm({ amount: e.target.value })} className="w-full p-2 border rounded-lg" />
                            <div className="flex gap-2">
                                <select
                                    value={billForm.category || getDefaultCategoryId(categories, 'EXPENSE', ['Housing & Bill', 'Other'])}
                                    onChange={e => updateBillForm({ category: e.target.value })}
                                    className="flex-1 p-2 border rounded-lg"
                                >
                                    {expenseCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                                </select>
                                <select value={billForm.billType || BillType.SUBSCRIPTION} onChange={e => updateBillForm({ billType: e.target.value as BillType })} className="flex-1 p-2 border rounded-lg">
                                    {Object.values(BillType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Group (e.g. Housing)" value={billForm.groupName || ''} onChange={e => updateBillForm({ groupName: e.target.value })} className="flex-1 p-2 border rounded-lg" />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500 whitespace-nowrap">Day:</span>
                                    <input type="number" min="1" max="31" value={billForm.dayOfMonth || 1} onChange={e => updateBillForm({ dayOfMonth: e.target.value })} className="w-16 p-2 border rounded-lg" />
                                </div>
                            </div>
                        </>
                    )}
                    {modalType === 'pay-card' && payCardForm && (
                        <>
                            <p className="text-sm text-slate-500 mb-2">Pay off your credit card debt from another account.</p>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Date</label>
                                    <input type="date" value={payCardForm.date || ''} onChange={e => updatePayCardForm({ date: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Category</label>
                                    <select
                                        value={payCardForm.category || getDefaultCategoryId(categories, 'TRANSFER', ['Card Payment', 'Savings/Invest'])}
                                        onChange={e => updatePayCardForm({ category: e.target.value })}
                                        className="w-full p-2 border rounded-lg text-sm"
                                    >
                                        {transferCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Amount</label>
                                <input type="number" placeholder="Payment Amount" value={payCardForm.amount || ''} onChange={e => updatePayCardForm({ amount: e.target.value })} className="w-full p-4 border border-rose-200 bg-rose-50 rounded-xl font-bold text-2xl text-rose-900 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Withdraw From</label>
                                <select value={paymentAsset} onChange={e => setPaymentAsset(e.target.value)} className="w-full p-2 border rounded-lg">
                                    {assets.filter(a => a.type !== AssetType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.institution ? `${a.institution} ${a.name}` : a.name} ({a.balance.toLocaleString()})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Details</label>
                                <input type="text" placeholder="Details" value={payCardForm.memo || ''} onChange={e => updatePayCardForm({ memo: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                            </div>
                        </>
                    )}
                    {modalType === 'goal' && goalForm && (
                        <>
                            <input type="text" placeholder="Goal Name" value={goalForm.name || ''} onChange={e => updateGoalForm({ name: e.target.value })} className="w-full p-2 border rounded-lg" />
                            <input type="number" placeholder="Target Amount" value={goalForm.targetAmount || ''} onChange={e => updateGoalForm({ targetAmount: e.target.value })} className="w-full p-2 border rounded-lg" />
                            <div className="flex gap-2">
                                <input type="text" placeholder="Emoji" value={goalForm.emoji || '🎯'} onChange={e => updateGoalForm({ emoji: e.target.value })} className="w-20 p-2 border rounded-lg" />
                                <input type="date" value={goalForm.deadline || ''} onChange={e => updateGoalForm({ deadline: e.target.value })} className="flex-1 p-2 border rounded-lg" />
                            </div>
                        </>
                    )}
                    {modalType === 'budget' && budgetForm && (
                        <>
                            <p className="text-sm text-slate-500 mb-2">Set your total monthly budget or expected income.</p>
                            <input type="number" placeholder="e.g. 3,000,000" value={budgetForm.amount || ''} onChange={e => updateBudgetForm({ amount: e.target.value })} className="w-full p-4 border border-blue-200 bg-blue-50 rounded-xl font-bold text-2xl text-blue-900 focus:outline-none" autoFocus />
                        </>
                    )}
                    {(modalType === 'pay-bill' || modalType === 'fund-goal') && (
                        <>
                            {modalType === 'fund-goal' && fundGoalForm && <input type="number" placeholder="Amount to Add" value={fundGoalForm.amount || ''} onChange={e => updateFundGoalForm({ amount: e.target.value })} className="w-full p-2 border rounded-lg font-bold text-lg" autoFocus />}
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
                            {(modalType === 'bill' || modalType === 'goal') && (selectedBill || selectedGoal) && (
                                <button
                                    onClick={onDeleteSelected}
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

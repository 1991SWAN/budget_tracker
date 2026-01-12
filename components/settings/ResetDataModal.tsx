import React, { useState } from 'react';
import { X, AlertTriangle, Check, Trash2 } from 'lucide-react';

interface ResetDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (options: ResetOptions) => Promise<void>;
}

export interface ResetOptions {
    transactions: boolean;
    assets: boolean;
    goals: boolean;
    recurring: boolean;
    categories: boolean;
    budgets: boolean;
    tags: boolean;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [options, setOptions] = useState<ResetOptions>({
        transactions: true,
        assets: true,
        goals: true,
        recurring: true,
        categories: true,
        budgets: true,
        tags: true,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmStep, setConfirmStep] = useState<'select' | 'confirm'>('select');

    if (!isOpen) return null;

    const toggleOption = (key: keyof ResetOptions) => {
        setOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSelectAll = () => {
        const allSelected = Object.values(options).every(v => v);
        const newState = !allSelected;
        setOptions({
            transactions: newState,
            assets: newState,
            goals: newState,
            recurring: newState,
            categories: newState,
            budgets: newState,
            tags: newState,
        });
    };

    const handleNext = () => {
        // Ensure at least one is selected
        if (!Object.values(options).some(v => v)) {
            alert("Please select at least one item to reset.");
            return;
        }
        setConfirmStep('confirm');
    };

    const handleFinalConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(options);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to reset data.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-rose-50">
                    <div className="flex items-center gap-2 text-rose-600">
                        <AlertTriangle size={20} />
                        <h2 className="font-bold text-lg">Reset Data</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-white/50 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {confirmStep === 'select' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 mb-2">
                                Select the data you want to permanently delete. <br />
                                <span className="font-bold text-rose-600">This action cannot be undone.</span>
                            </p>

                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={handleSelectAll}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                >
                                    {Object.values(options).every(v => v) ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                <CheckboxOption
                                    label="Transactions (Income/Expense)"
                                    checked={options.transactions}
                                    onChange={() => toggleOption('transactions')}
                                />
                                <CheckboxOption
                                    label="Assets (Accounts & Wallets)"
                                    checked={options.assets}
                                    onChange={() => toggleOption('assets')}
                                    subtext="Deleting assets may affect linked transactions."
                                />
                                <CheckboxOption
                                    label="Recurring (Subscriptions)"
                                    checked={options.recurring}
                                    onChange={() => toggleOption('recurring')}
                                />
                                <CheckboxOption
                                    label="Savings Goals"
                                    checked={options.goals}
                                    onChange={() => toggleOption('goals')}
                                />
                                <CheckboxOption
                                    label="Budgets"
                                    checked={options.budgets}
                                    onChange={() => toggleOption('budgets')}
                                />
                                <CheckboxOption
                                    label="Custom Categories"
                                    checked={options.categories}
                                    onChange={() => toggleOption('categories')}
                                />
                                <CheckboxOption
                                    label="Tags"
                                    checked={options.tags}
                                    onChange={() => toggleOption('tags')}
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleNext}
                                    disabled={!Object.values(options).some(v => v)}
                                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 text-center py-4">
                            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 mb-2">
                                <Trash2 size={32} />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-900">Are you absolutely sure?</h3>
                                <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl text-left space-y-1">
                                    <p className="font-semibold mb-2">You are about to delete:</p>
                                    <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                                        {options.transactions && <li>All Transactions</li>}
                                        {options.assets && <li>All Assets</li>}
                                        {options.recurring && <li>Recurring Payments</li>}
                                        {options.goals && <li>Savings Goals</li>}
                                        {options.budgets && <li>Budgets</li>}
                                        {options.categories && <li>Custom Categories</li>}
                                        {options.tags && <li>Tags</li>}
                                    </ul>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setConfirmStep('select')}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleFinalConfirm}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Trash2 size={16} />
                                            <span>Delete Forever</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CheckboxOption = ({ label, checked, onChange, subtext }: { label: string, checked: boolean, onChange: () => void, subtext?: string }) => (
    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50'
        }`}>
        <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
            }`}>
            {checked && <Check size={12} className="text-white" />}
        </div>
        <input type="checkbox" checked={checked} onChange={onChange} className="hidden" />
        <div className="flex-1">
            <p className={`text-sm font-bold ${checked ? 'text-indigo-900' : 'text-slate-700'}`}>{label}</p>
            {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
        </div>
    </label>
);

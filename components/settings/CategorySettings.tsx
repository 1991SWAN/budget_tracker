import React, { useState } from 'react';
import { View, CategoryItem } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useCategoryManager } from '../../hooks/useCategoryManager';
import { useBudgetManager } from '../../hooks/useBudgetManager';
import { ChevronLeft, Pencil, Trash2, Plus, AlertTriangle } from 'lucide-react';

// Simple Emoji & Color Picker or Input for Phase 1
// We can enhance this later with a full picker
const CategoryFormModal = ({
    initialData,
    initialBudget,
    onSave,
    onCancel
}: {
    initialData?: CategoryItem;
    initialBudget?: number;
    onSave: (data: { name: string; type: 'EXPENSE' | 'INCOME' | 'TRANSFER'; emoji: string; color: string; budgetAmount?: number; keywords: string[] }) => void;
    onCancel: () => void;
}) => {
    const [name, setName] = useState(initialData?.name || '');
    const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>(initialData?.type || 'EXPENSE');
    const [emoji, setEmoji] = useState(initialData?.emoji || '🏷️');
    const [color, setColor] = useState(initialData?.color || 'bg-slate-500');
    const [budget, setBudget] = useState<string>(initialBudget ? initialBudget.toString() : '');
    const [keywords, setKeywords] = useState(initialData?.keywords?.join(', ') || '');

    // Simple Color Palette
    const colors = [
        'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500',
        'bg-green-500', 'bg-teal-500', 'bg-blue-500', 'bg-indigo-500',
        'bg-violet-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500'
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
                <h3 className="text-xl font-bold text-slate-800 mb-4">{initialData ? 'Edit Category' : 'New Category'}</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {['EXPENSE', 'INCOME', 'TRANSFER'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setType(t as any)}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Groceries"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Monthly Budget (Optional)</label>
                        <input
                            type="number"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. 500000"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Keywords (Comma Separated)</label>
                        <input
                            type="text"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Starbucks, Uber, Netflix"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Used for auto-categorization during import.</p>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Emoji</label>
                            <input
                                type="text"
                                value={emoji}
                                onChange={(e) => setEmoji(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-center text-xl"
                                placeholder="🏷️"
                            />
                        </div>
                        <div className="flex-[2]">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Color</label>
                            <div className="grid grid-cols-6 gap-2">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-6 h-6 rounded-full ${c} ${color === c ? 'ring-2 ring-offset-2 ring-slate-400' : 'opacity-70 hover:opacity-100'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 pt-6">
                    <button onClick={onCancel} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-medium">Cancel</button>
                    <button
                        onClick={() => onSave({
                            name, type, emoji, color,
                            budgetAmount: budget ? Number(budget) : undefined,
                            keywords: keywords.split(',').map(k => k.trim()).filter(Boolean)
                        })}
                        className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                        disabled={!name.trim()}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export const CategorySettings = ({ onNavigate }: { onNavigate: (view: View) => void }) => {
    const { categories, isLoading, addCategory, updateCategory, deleteCategory, resetCategories } = useCategoryManager();
    const { budgets, saveBudget } = useBudgetManager();
    const [selectedTab, setSelectedTab] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
    const [editingItem, setEditingItem] = useState<CategoryItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const filteredCategories = categories.filter(c => c.type === selectedTab);

    return (
        <div className="space-y-6 p-6 max-w-3xl mx-auto pb-24">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => onNavigate('settings')}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                >
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
                    <p className="text-slate-500 text-sm">Manage transaction categories.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                {['EXPENSE', 'INCOME', 'TRANSFER'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab as any)}
                        className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${selectedTab === tab
                            ? 'border-primary text-primary'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        {tab === 'EXPENSE' ? 'Expenses' : tab === 'INCOME' ? 'Income' : 'Transfers'}
                    </button>
                ))}
            </div>

            {/* List */}
            {isLoading ? (
                <div className="py-12 text-center text-slate-400">Loading categories...</div>
            ) : (
                <div className="space-y-3">
                    {filteredCategories.map((category) => (
                        <Card key={category.id} className="flex items-center justify-between p-4 hover:shadow-sm transition-shadow group">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl bg-slate-50 ${category.color?.replace('bg-', 'text-') || 'text-slate-500'}`}>
                                    {category.emoji}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">{category.name}</h4>
                                    <div className="flex gap-2 text-[10px] mt-0.5">
                                        {category.is_default && <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Default</span>}
                                        {budgets.find(b => b.category_id === category.id)?.amount ? (
                                            <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-medium">
                                                Budget: {budgets.find(b => b.category_id === category.id)?.amount.toLocaleString()}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => setEditingItem(category)}
                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                                >
                                    <Pencil size={16} />
                                </button>
                                {!category.is_default && (
                                    <button
                                        onClick={() => deleteCategory(category.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </Card>
                    ))}

                    <div className="flex flex-col gap-4 w-full">
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-primary hover:text-primary hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={20} /> Add New Category
                        </button>

                        <div className="mt-8 pt-8 border-t border-slate-100">
                            <h4 className="text-sm font-semibold text-slate-400 mb-4">Danger Zone</h4>
                            <Button
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (showResetConfirm) {
                                        resetCategories();
                                        setShowResetConfirm(false);
                                    } else {
                                        setShowResetConfirm(true);
                                        // Auto-cancel after 3 seconds
                                        setTimeout(() => setShowResetConfirm(false), 3000);
                                    }
                                }}
                                type="button"
                                variant="ghost"
                                className={`w-full border transition-all ${showResetConfirm ? 'bg-red-500 text-white hover:bg-red-600 border-red-500' : 'text-red-500 hover:bg-red-50 hover:text-red-600 border-red-100'}`}
                            >
                                {showResetConfirm ? (
                                    <span className="flex items-center gap-2 justify-center w-full"><AlertTriangle size={16} /> Are you sure? Click again to confirm</span>
                                ) : (
                                    <span className="flex items-center gap-2 justify-center w-full"><AlertTriangle size={16} /> Reset All Categories to Defaults</span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {(isAdding || editingItem) && (
                <CategoryFormModal
                    initialData={editingItem || undefined}
                    initialBudget={editingItem ? budgets.find(b => b.category_id === editingItem.id)?.amount : undefined}
                    onCancel={() => { setIsAdding(false); setEditingItem(null); }}
                    onSave={async (data) => {
                        let categoryId = editingItem?.id;

                        if (editingItem) {
                            updateCategory({ ...editingItem, ...data });
                        } else {
                            // addCategory in useCategoryManager now returns the ID
                            const newId = await addCategory(data.name, data.type, data.emoji, data.color, data.keywords);
                            if (newId) categoryId = newId;
                        }

                        if (categoryId && data.budgetAmount !== undefined) {
                            await saveBudget({
                                category_id: categoryId,
                                amount: data.budgetAmount
                            });
                        }

                        setIsAdding(false);
                        setEditingItem(null);
                    }}
                />
            )}
        </div>
    );
};

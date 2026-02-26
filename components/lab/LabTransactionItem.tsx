import React, { memo, useState } from 'react';
import { Sparkles, PlusCircle, Trash2 } from 'lucide-react';
import { Transaction, Asset, CategoryItem, TransactionType } from '../../types';
import { RegularCandidate } from '../../hooks/useRegularExpenseDetector';
import { Button } from '../ui/Button';

// Inline Components
import { InlineText } from '../ui/inline/InlineText';
import { InlineNumber } from '../ui/inline/InlineNumber';
import { InlineDate } from '../ui/inline/InlineDate';
import { InlineDateTime } from '../ui/inline/InlineDateTime';
import { InlineCategoryPicker } from '../ui/inline/InlineCategoryPicker';

interface LabTransactionItemProps {
    transaction: Transaction;
    asset?: Asset;
    toAsset?: Asset;
    fromAsset?: Asset;
    categories: CategoryItem[];
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;

    // Lab Specific
    isCandidate?: boolean;
    candidateData?: RegularCandidate;
    onRegisterRegular?: (candidate: RegularCandidate) => void;
    isSelected?: boolean;
}

const LabTransactionItem: React.FC<LabTransactionItemProps> = ({
    transaction,
    asset,
    toAsset,
    fromAsset,
    categories,
    onEdit,
    onDelete,
    isCandidate = false,
    candidateData,
    onRegisterRegular,
    isSelected = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const isExpense = transaction.type === TransactionType.EXPENSE;
    const isIncome = transaction.type === TransactionType.INCOME;
    const isTransfer = transaction.type === TransactionType.TRANSFER;

    const handleUpdateField = (field: keyof Transaction, value: any) => {
        const updatedTx = { ...transaction, [field]: value };
        onEdit(updatedTx);
    };

    // Parse Memo for display vs Edit value
    const { cleanMemo, isMention, tags } = React.useMemo(() => {
        const rawMemo = transaction.memo || '';
        let clean = rawMemo;

        const tagMatches = rawMemo.match(/#(\S+)/g);
        const tags = tagMatches ? tagMatches.map(t => t) : [];
        if (tagMatches) {
            tagMatches.forEach(tag => {
                clean = clean.replace(tag, '');
            });
        }

        const mentionMatch = clean.match(/@(\S+)/);
        let merchantName = null;

        if (mentionMatch) {
            merchantName = mentionMatch[1];
            clean = clean.replace(mentionMatch[0], '');
        }

        return {
            cleanMemo: clean.trim() || merchantName || '', // Provide at least merchant name if empty
            isMention: !!merchantName,
            tags
        };
    }, [transaction.memo]);

    // Color Logic for Amount
    let amountColor = 'text-slate-900';
    if (isExpense) amountColor = 'text-rose-600';
    else if (isIncome) amountColor = 'text-emerald-600';
    else if (isTransfer) {
        if (transaction.toAssetId) amountColor = 'text-rose-600'; // Source
        else if (transaction.linkedTransactionId && !transaction.toAssetId) amountColor = 'text-emerald-600'; // Dest
        else amountColor = 'text-blue-600';
    }

    // Format Time for Display
    const timeStr = React.useMemo(() => {
        try {
            if (transaction.timestamp) {
                const dateObj = new Date(transaction.timestamp);
                if (!isNaN(dateObj.getTime())) {
                    const hh = dateObj.getHours().toString().padStart(2, '0');
                    const mm = dateObj.getMinutes().toString().padStart(2, '0');
                    return `${hh}:${mm}`;
                }
            }
        } catch (e) { }
        return '--:--:--';
    }, [transaction.timestamp]);

    return (
        <div className={`relative border-b border-slate-50 last:border-0 group transition-colors ${isSelected ? 'bg-rose-50/40' : 'hover:bg-slate-50/50'}`}>
            {/* Custom Grid Layout Restored (with Interactive Inline Components) */}
            <div className="grid grid-cols-[50px_1fr_auto] lg:grid-cols-[60px_1.5fr_1.2fr_1fr] gap-2 py-1.5 px-4 items-center relative">

                {/* Col 1: Time */}
                <div className="text-center">
                    <InlineDateTime
                        value={transaction.timestamp}
                        className="w-full flex justify-center rounded transition-colors"
                        onSave={(val) => handleUpdateField('timestamp', val)}
                        displayComponent={<span className="text-xs font-bold text-slate-400 font-mono tracking-tighter block opacity-60 hover:text-slate-600 hover:bg-slate-100 px-1 py-0.5 rounded transition-colors">{timeStr}</span>}
                    />
                </div>

                {/* Col 2: Merchant & Memo & Asset */}
                <div className="min-w-0 flex items-center justify-between gap-2 pr-1">
                    <div className="flex flex-col overflow-hidden w-full">
                        <InlineText
                            value={transaction.memo || ''}
                            onSave={(val) => handleUpdateField('memo', val)}
                            placeholder="Add description..."
                            className="w-full hover:bg-transparent flex-none min-h-0 py-0"
                            displayComponent={
                                <div className="flex items-center gap-2 hover:bg-slate-100/70 transition-colors -ml-1 px-1 py-0.5 rounded">
                                    <p className="font-bold text-[15px] truncate leading-tight text-slate-900 group-hover:text-slate-700 transition-colors">
                                        {cleanMemo || <span className="text-slate-400 font-normal italic">No Description</span>}
                                    </p>
                                    {isCandidate && !isExpanded && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsExpanded(true);
                                            }}
                                            className="group/sparkle flex items-center justify-center cursor-pointer p-0.5 shrink-0"
                                            title="View Recurring Recommendation"
                                        >
                                            <Sparkles className="text-amber-500 w-3.5 h-3.5 animate-[pulse_3s_ease-in-out_infinite] drop-shadow-sm transition-all duration-300 group-hover/sparkle:scale-125 group-hover/sparkle:text-amber-400 group-hover/sparkle:drop-shadow-md" />
                                        </div>
                                    )}
                                </div>
                            }
                        />

                        {/* Mobile Subtext Row: Category/Merchant + Tags */}
                        <div className="text-xs text-slate-500 truncate mt-0.5 lg:hidden flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-600 font-medium">
                                {/* Mobile read-only category fallback */}
                                {(categories || []).find(c => c.id === transaction.category)?.emoji} {(categories || []).find(c => c.id === transaction.category)?.name || transaction.category}
                            </span>
                            {/* Tags Display */}
                            {tags.length > 0 && (
                                <div className="flex items-center gap-1">
                                    {tags.map((tag, idx) => (
                                        <span key={idx} className="text-[11px] text-blue-500 font-medium bg-blue-50 px-1 rounded-md">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Desktop: Tags Row */}
                        <div className="mt-0.5 hidden lg:flex items-center gap-2">
                            {/* Tags Display (Desktop) */}
                            {tags.map((tag, idx) => (
                                <span key={idx} className="text-[11px] text-blue-500 font-medium bg-blue-50 px-1 rounded-md">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Inner Col 2: Asset Name Badge (Mobile Only) */}
                    <div className="lg:hidden shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 border border-slate-100 rounded bg-white">
                            {asset?.name || 'Unknown'}
                        </span>
                    </div>
                </div>

                {/* Col 3: Center 2 (Desktop Only - Category, Asset, Installment Badge) */}
                <div className="hidden lg:flex flex-nowrap gap-2 items-center">
                    <InlineCategoryPicker
                        value={transaction.category}
                        options={categories}
                        onSave={(val) => handleUpdateField('category', val)}
                    />

                    {transaction.installment && (
                        <span className="px-2 py-0.5 bg-blue-50/50 text-blue-600 rounded-md text-[10px] font-bold whitespace-nowrap flex items-center h-fit shrink-0">
                            {transaction.installment.totalMonths} mos
                        </span>
                    )}
                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap px-1 shrink-0 truncate max-w-[120px]">
                        {asset?.name || 'Unknown'}
                    </span>
                </div>

                {/* Col 4: Amount & Actions (Right) */}
                <div className="text-right flex items-center justify-end gap-2 min-w-0 pr-6 lg:pr-8">
                    <div className="flex flex-col items-end w-full">
                        {isTransfer && ((toAsset) || (fromAsset && !toAsset)) ? (
                            <div className="flex flex-col items-end cursor-not-allowed opacity-80" title="Transfers must be edited via modal currently">
                                {/* Line 1: Source (Withdrawal) */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 max-w-[60px] truncate hidden md:block">
                                        {toAsset ? asset?.name : fromAsset?.name}
                                    </span>
                                    <span className="text-[15px] font-bold text-rose-600 tracking-tight">
                                        -{transaction.amount.toLocaleString()}
                                    </span>
                                </div>
                                {/* Line 2: Destination (Deposit) */}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-slate-400 max-w-[60px] truncate hidden md:block">
                                        {toAsset ? toAsset.name : asset?.name}
                                    </span>
                                    <span className="text-[15px] font-bold text-emerald-600 tracking-tight">
                                        +{transaction.amount.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex w-full justify-end items-center relative group/amount">
                                <InlineNumber
                                    value={transaction.amount}
                                    isExpense={isExpense}
                                    textClassName={`font-bold text-[15px] tabular-nums tracking-tight pl-2 pr-1 py-0.5 rounded hover:bg-slate-100/70 transition-colors ${amountColor}`}
                                    onSave={(val) => handleUpdateField('amount', val)}
                                />
                            </div>
                        )}

                        {/* Installment Monthly Amount */}
                        {transaction.installment && transaction.installment.totalMonths > 1 && (
                            <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                                ({Math.round(transaction.amount / transaction.installment.totalMonths).toLocaleString()}/mo)
                            </p>
                        )}
                    </div>
                </div>

                {/* Desktop Action Buttons (Always visible multi-select delete for Lab) */}
                <div className="absolute right-0 top-0 bottom-0 flex items-center px-4 transition-all duration-300">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(transaction); }}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isSelected
                            ? 'text-rose-500 hover:text-rose-600 bg-rose-50'
                            : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                            }`}
                        title={isSelected ? "Deselect" : "Select for deletion"}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Lab Feature: Inline Recommendation Expansion */}
            {isCandidate && isExpanded && candidateData && (
                <div className="px-4 py-3 bg-amber-50/50 border-t border-amber-100 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between animate-in slide-in-from-top-2 duration-300">
                    <div className="flex gap-3 items-start">
                        <div className="p-2 bg-amber-100/50 rounded-xl text-amber-500 shrink-0 mt-0.5">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-900 tracking-tight">
                                Recurring pattern detected
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Avg. <strong>₩{candidateData.averageAmount.toLocaleString()}</strong> over {candidateData.occurrences} months
                            </p>
                        </div>
                    </div>
                    <div className="w-full md:w-auto flex gap-2">
                        <Button
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                            variant="ghost"
                            size="sm"
                            className="flex-1 md:flex-none text-slate-500 hover:text-slate-700"
                        >
                            Dismiss
                        </Button>
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onRegisterRegular) onRegisterRegular(candidateData);
                                setIsExpanded(false);
                            }}
                            variant="primary"
                            size="sm"
                            className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 border-transparent text-white gap-1.5 shadow-sm"
                        >
                            <PlusCircle size={14} />
                            Add Bill
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(LabTransactionItem);

import React, { memo } from 'react';
import { Pencil, Sparkles, PlusCircle, Trash2 } from 'lucide-react';
import { Transaction, TransactionType, Asset, CategoryItem, RecurringTransaction } from '../types';
import { Button } from './ui/Button';
import { RegularCandidate } from '../hooks/useRegularExpenseDetector';
import { Repeat } from 'lucide-react';

// Inline Components
import { InlineText } from './ui/inline/InlineText';
import { InlineNumber } from './ui/inline/InlineNumber';
import { InlineDateTime } from './ui/inline/InlineDateTime';
import { InlineCategoryPicker } from './ui/inline/InlineCategoryPicker';
import { InlineAssetPicker } from './ui/inline/InlineAssetPicker';

interface TransactionItemProps {
    transaction: Transaction;
    asset?: Asset;
    toAsset?: Asset; // For transfers (Destination)
    fromAsset?: Asset; // For transfers (Source - when viewing Target)
    categories: CategoryItem[];
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;

    // Bulk Selection Props
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    onLongPress?: () => void;
    // Deduplication Prop
    presentTxIds?: Set<string>;

    // Recurring Setup Candidate Props
    isCandidate?: boolean;
    candidateData?: RegularCandidate;
    onRegisterRegular?: (candidate: RegularCandidate) => void;
    onInlineEdit?: (updatedTx: Transaction) => void;
    recurring?: RecurringTransaction[];
    assets?: Asset[];
}

const TransactionItem: React.FC<TransactionItemProps> = ({
    transaction,
    asset,
    toAsset,
    fromAsset,
    categories = [],
    onEdit,
    onDelete,
    isSelectionMode = false,
    isSelected = false,
    onToggleSelect,
    onLongPress,
    presentTxIds,
    isCandidate = false,
    candidateData,
    onRegisterRegular,
    onInlineEdit,
    recurring = [],
    assets = []
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [showCandidateSetup, setShowCandidateSetup] = React.useState(false);

    const handleUpdateField = (field: keyof Transaction, value: any) => {
        if (!onInlineEdit) return;
        const updatedTx = { ...transaction, [field]: value };
        onInlineEdit(updatedTx);
    };

    const isRecurring = React.useMemo(() => {
        // Check if memo or merchant matches any recurring bill name
        const memo = transaction.memo?.toLowerCase() || '';
        const merchant = (transaction as any).merchant?.toLowerCase() || '';
        return recurring.some(r =>
            memo.includes(r.name.toLowerCase()) ||
            r.name.toLowerCase().includes(memo) ||
            (merchant && (merchant.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(merchant)))
        );
    }, [transaction.memo, (transaction as any).merchant, recurring]);

    // Long Press Logic
    const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
    const isLongPressTriggered = React.useRef(false);

    const handleTouchStart = () => {
        isLongPressTriggered.current = false;
        longPressTimer.current = setTimeout(() => {
            if (onLongPress) {
                isLongPressTriggered.current = true;
                onLongPress();
                // Vibration feedback (haptic) if supported
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
            }
        }, 500); // 500ms for long press
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const isExpense = transaction.type === TransactionType.EXPENSE;
    const isIncome = transaction.type === TransactionType.INCOME;
    const isTransfer = transaction.type === TransactionType.TRANSFER;

    const formattedAmount = transaction.amount.toLocaleString();

    // Find Category Info
    const categoryItem = categories.find(c => c.id === transaction.category) ||
        categories.find(c => c.name === transaction.category); // Fallback for legacy names

    const categoryName = categoryItem ? categoryItem.name : transaction.category;
    const categoryEmoji = categoryItem ? categoryItem.emoji : '🏷️';
    // Use category color if available, default to slate
    const categoryColorClass = categoryItem?.color ? categoryItem.color.replace('bg-', 'text-') : 'text-slate-600';

    // Determine sign and color
    let amountSign = '';
    let amountColor = 'text-slate-900';
    if (isExpense) {
        amountSign = '-';
        amountColor = 'text-rose-600';
    } else if (isIncome) {
        amountSign = '+';
        amountColor = 'text-emerald-600';
    } else if (isTransfer) {
        // V3 Logic: Source (Withdrawal) is Red/-, Dest (Deposit) is Green/+
        if (transaction.toAssetId) {
            amountSign = '-';
            amountColor = 'text-rose-600'; // Source
        } else if (transaction.linkedTransactionId && !transaction.toAssetId) {
            amountSign = '+';
            amountColor = 'text-emerald-600'; // Dest (should be hidden usually, but if visible)
        } else {
            amountColor = 'text-blue-600'; // Unlinked Transfer or Legacy
        }
    }

    // Time Logic
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
        return '--:--';
    }, [transaction.timestamp]);

    // VIEW PARSING LOGIC: Handle @Mentions and #Tags
    const { mainText, subText, isMention, tags } = React.useMemo(() => {
        const rawMemo = transaction.memo || '';
        let cleanMemo = rawMemo;

        // 1. Prioritize Structured Data (Merchant)
        if (transaction.merchant) {
            // Remove the @Merchant if it exists in memo for clean display
            cleanMemo = cleanMemo.replace(`@${transaction.merchant}`, '').trim();
            return {
                mainText: cleanMemo || 'Transaction',
                subText: transaction.merchant,
                isMention: true,
                tags: transaction.tags ? transaction.tags.map(t => typeof t === 'string' ? { name: t } : { name: t.name, color: t.color }) : []
            };
        }

        // 2. Fallback to parsing Tags (#) from memo if transaction.tags is empty
        const tagMatches = rawMemo.match(/#(\S+)/g);
        const displayTags = (transaction.tags && transaction.tags.length > 0) 
            ? transaction.tags.map(t => typeof t === 'string' ? { name: t } : { name: t.name, color: t.color })
            : (tagMatches ? tagMatches.map(t => ({ name: t.replace('#', '') })) : []);
            
        if (tagMatches) {
            tagMatches.forEach(tag => {
                cleanMemo = cleanMemo.replace(tag, ''); 
            });
        }

        // 3. Fallback to parsing Merchant (@) from memo
        const mentionMatch = cleanMemo.match(/@(\S+)/);
        let merchantName = null;

        if (mentionMatch) {
            merchantName = mentionMatch[1];
            cleanMemo = cleanMemo.replace(mentionMatch[0], '');
        }

        return {
            mainText: cleanMemo.trim() || (merchantName ? '' : 'No Description'),
            subText: merchantName,
            isMention: !!merchantName,
            tags: displayTags
        };
    }, [transaction.memo, transaction.merchant, transaction.tags]);

    const handleRowClick = () => {
        // Only trigger selection if not in an active inline edit or if clicked on non-interactive area
        // But for simplicity, we allow selection mode to take priority if isSelectionMode is on
        if (isSelectionMode && onToggleSelect) {
            onToggleSelect();
        }
    };

    return (
        <div
            className={`w-full relative group transition-all duration-300 hover:z-50 focus-within:z-50 hover:bg-slate-50/30`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
        >
            {/* Remove the absolute positioned sparkle indicator and move it to memo section */}

            {/* Main Row */}
            <div
                className="grid grid-cols-[50px_1fr_auto] lg:grid-cols-[60px_1.5fr_1.2fr_1fr] gap-3 lg:gap-4 py-2 lg:py-1.5 px-4 items-center cursor-pointer"
                onClick={handleRowClick}
            >

                {/* Col 1: Time */}
                <div className="text-center">
                    <InlineDateTime
                        value={transaction.timestamp}
                        className="w-full flex justify-center rounded transition-colors"
                        onSave={(val) => {
                            if (!onInlineEdit) return;
                            const d = new Date(val);
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            const newDateStr = `${y}-${m}-${day}`;

                            onInlineEdit({
                                ...transaction,
                                timestamp: d.getTime(),
                                date: newDateStr
                            });
                        }}
                        displayComponent={<span className="text-xs font-bold text-slate-400 font-mono tracking-tighter block opacity-60 hover:text-slate-600 hover:bg-slate-100 px-1 py-0.5 rounded transition-colors">{timeStr}</span>}
                    />
                </div>

                {/* Col 2: Merchant & Memo & Asset (Mobile Center: 2 Columns) */}
                <div className="min-w-0 flex items-center justify-between gap-2 pr-1">
                    {/* Inner Col 1: Text Info */}
                    <div className="flex flex-col min-w-0 w-full">
                        <InlineText
                            value={transaction.memo || ''}
                            onSave={(val) => handleUpdateField('memo', val)}
                            placeholder="Add description..."
                            className="w-full hover:bg-transparent flex-none min-h-0 py-0"
                            displayComponent={
                                <div className="flex items-center gap-2 hover:bg-slate-100/70 transition-colors -ml-1 px-1 py-0.5 rounded">
                                    <p className={`font-bold text-[15px] truncate leading-tight ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                                        {mainText || <span className="text-slate-400 font-normal italic">No Description</span>}
                                    </p>
                                    {isCandidate && !showCandidateSetup && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowCandidateSetup(true);
                                            }}
                                            className="flex items-center justify-center cursor-pointer p-0.5 shrink-0"
                                            title="View Recurring Recommendation"
                                        >
                                            <Sparkles className="text-amber-400 w-3.5 h-3.5 animate-pulse" />
                                        </div>
                                    )}
                                    {isRecurring && (
                                        <Repeat size={14} className="text-indigo-400 shrink-0 opacity-70" title="Fixed Expense" />
                                    )}
                                </div>
                            }
                        />

                        {/* Mobile Subtext Row: Category/Merchant + Tags */}
                        <div className="text-xs text-slate-500 truncate mt-0.5 lg:hidden flex items-center gap-1.5 flex-wrap">
                            {/* Merchant or Category */}
                            {subText ? (
                                isMention ? (
                                    <span className="text-slate-500 text-[11px] font-medium flex items-center gap-0.5">
                                        <span className="text-purple-400">@</span>{subText}
                                    </span>
                                ) : (
                                    <span className="text-slate-600">{subText}</span>
                                )
                            ) : (
                                <InlineCategoryPicker
                                    value={transaction.category}
                                    options={categories}
                                    onSave={(val) => handleUpdateField('category', val)}
                                    className="!p-0 !min-h-0"
                                />
                            )}

                            {/* Tags Display */}
                            {tags.length > 0 && (
                                <div className="flex items-center gap-1">
                                    {tags.map((tag, idx) => (
                                        <span 
                                            key={idx} 
                                            className={`text-[11px] font-medium px-1 rounded-md ${tag.color || 'bg-blue-50 text-blue-500'}`}
                                        >
                                            #{tag.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Desktop: SubText Row */}
                        <div className="mt-0.5 hidden lg:flex items-center gap-2">
                            {subText && (
                                isMention ? (
                                    <span className="text-[11px] text-slate-400 font-medium">@{subText}</span>
                                ) : (
                                    <span className="text-xs text-slate-500 truncate">{subText}</span>
                                )
                            )}
                            {/* Tags Display (Desktop) */}
                            {tags.map((tag, idx) => (
                                <span 
                                    key={idx} 
                                    className={`text-[11px] font-medium px-1 rounded-md cursor-pointer transition-colors ${tag.color || 'bg-blue-50 text-blue-500 hover:bg-blue-100'}`}
                                >
                                    #{tag.name}
                                </span>
                            ))}
                        </div>
                    </div>


                    {/* Inner Col 2: Asset Name Badge (Mobile Only) */}
                    <div className="lg:hidden shrink-0">
                        <InlineAssetPicker
                            value={transaction.assetId}
                            options={assets}
                            onSave={(val) => handleUpdateField('assetId', val)}
                        />
                    </div>
                </div>

                {/* Col 3: Center 2 (Desktop Only - Category, Asset, Installment Badge) */}
                <div className="hidden lg:flex flex-nowrap gap-4 items-center">
                    <InlineCategoryPicker
                        value={transaction.category}
                        options={categories}
                        onSave={(val) => handleUpdateField('category', val)}
                    />
                    {transaction.installment && (
                        <InlineNumber
                            value={transaction.installment.totalMonths}
                            isExpense={false}
                            isCurrency={false}
                            className="!min-h-0 !p-0 !min-w-0"
                            inputClassName="w-10 min-w-[40px] text-center"
                            displayComponent={
                                <div className="px-2 py-0.5 bg-blue-50/50 text-blue-600 rounded-md text-[10px] font-bold whitespace-nowrap flex items-center h-fit shrink-0 hover:bg-blue-100/60 transition-colors cursor-pointer">
                                    <span>{transaction.installment.totalMonths} mos</span>
                                </div>
                            }
                            onSave={(val) => {
                                if (val <= 1) {
                                    handleUpdateField('installment', undefined);
                                } else {
                                    handleUpdateField('installment', { ...transaction.installment, totalMonths: val });
                                }
                            }}
                        />
                    )}
                    <InlineAssetPicker
                        value={transaction.assetId}
                        options={assets}
                        onSave={(val) => handleUpdateField('assetId', val)}
                    />
                </div>

                {/* Col 4: Amount & Installment Info (Right) */}
                <div className="text-right flex items-center justify-end gap-2 min-w-0 pr-8 lg:pr-12">
                    <div className="flex flex-col items-end w-full">
                        {/* V3 Dual Line Display for Transfers (Unified) */}
                        {isTransfer && ((toAsset) || (fromAsset && !toAsset)) ? (
                            <div className="flex flex-col items-end">
                                {/* Line 1: Source (Withdrawal) - Always Red */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 max-w-[60px] truncate hidden md:block">
                                        {toAsset ? asset?.name : fromAsset?.name}
                                    </span>
                                    <span className="text-[15px] font-bold text-rose-600 tracking-tight">
                                        -{formattedAmount}
                                    </span>
                                </div>
                                {/* Line 2: Destination (Deposit) - Always Green */}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-slate-400 max-w-[60px] truncate hidden md:block">
                                        {toAsset ? toAsset.name : asset?.name}
                                    </span>
                                    <span className="text-[15px] font-bold text-emerald-600 tracking-tight">
                                        +{formattedAmount}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            // Standard Display
                            <div className="flex w-full justify-end items-center relative group/amount">
                                <InlineNumber
                                    value={transaction.amount}
                                    isExpense={isExpense}
                                    textClassName={`font-bold text-[15px] tabular-nums tracking-tight pl-2 pr-1 py-0.5 rounded hover:bg-slate-100/70 transition-colors ${amountColor}`}
                                    onSave={(val) => handleUpdateField('amount', val)}
                                />
                            </div>
                        )}

                        {/* Installment Monthly Amount (Visible on Mobile & Desktop) */}
                        {transaction.installment && transaction.installment.totalMonths > 1 && (
                            <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                                ({Math.round(transaction.amount / transaction.installment.totalMonths).toLocaleString()}/mo)
                            </p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3 pl-1 lg:pr-4 lg:pl-2 transition-all duration-300 gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); if (onToggleSelect) onToggleSelect(); else onDelete(transaction); }}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isSelected
                            ? 'text-rose-500'
                            : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                            }`}
                        title={isSelected ? "Deselect" : "Select for deletion"}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Recurring Bill Setup Expansion (Premium UI) */}
            {isCandidate && showCandidateSetup && candidateData && (
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
                            onClick={(e) => { e.stopPropagation(); setShowCandidateSetup(false); }}
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
                                setShowCandidateSetup(false);
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

            {/* Mobile Expanded Details (Fallback for context) */}
            {isExpanded && !isSelectionMode && (
                <div className="px-4 pb-3 pt-0 bg-slate-50/30 animate-in slide-in-from-top-1 border-t border-slate-100/50">
                    <div className="flex flex-wrap gap-2 my-2">
                        {/* Mobile Expanded: Memo (Moved here) */}
                        {transaction.merchant && transaction.memo && (
                            <div className="w-fit max-w-full text-[10px] text-slate-600 mb-0 px-2 py-1 bg-white border border-slate-100 rounded-lg break-words shadow-sm flex items-center">
                                <span className="font-bold mr-1 text-slate-400 shrink-0">Memo</span>
                                <span>{transaction.memo}</span>
                            </div>
                        )}

                        {/* Transaction Installment Badge */}
                        {transaction.installment && (
                            <>
                                <span className="px-2 py-1 h-fit bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold flex items-center">
                                    {transaction.installment.totalMonths} mo installment
                                </span>
                                {transaction.installment.isInterestFree && (
                                    <span className="px-2 py-1 h-fit bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center">
                                        Interest-free
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/50">
                        <Button
                            onClick={(e) => { e.stopPropagation(); onEdit(transaction); }}
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs font-bold shadow-sm h-auto py-1.5 bg-white border-slate-200"
                        >
                            Edit
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(TransactionItem);

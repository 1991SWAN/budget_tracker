import React, { memo } from 'react';
import { Transaction, TransactionType, Asset, CategoryItem } from '../types';
import { Button } from './ui/Button';

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
    presentTxIds
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

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
        if (!transaction.timestamp) return '--:--';
        const d = new Date(transaction.timestamp);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }, [transaction.timestamp]);

    // VIEW PARSING LOGIC: Handle @Mentions and #Tags
    const { mainText, subText, isMention, tags } = React.useMemo(() => {
        const rawMemo = transaction.memo || '';
        let cleanMemo = rawMemo;

        // 1. Extract Tags (#)
        const tagMatches = rawMemo.match(/#(\S+)/g);
        const tags = tagMatches ? tagMatches.map(t => t) : [];
        if (tagMatches) {
            tagMatches.forEach(tag => {
                cleanMemo = cleanMemo.replace(tag, ''); // Remove tag from text
            });
        }

        // 2. Legacy Merchant Check
        const legacyMerchant = (transaction as any).merchant;
        if (legacyMerchant) {
            return {
                mainText: legacyMerchant,
                subText: cleanMemo.trim(),
                isMention: false,
                tags
            };
        }

        // 3. Extract Merchant (@)
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
            tags
        };
    }, [transaction.memo, (transaction as any).merchant]);

    const handleRowClick = () => {
        // 1. If Selection Mode, always toggle
        if (isSelectionMode && onToggleSelect) {
            onToggleSelect();
            return;
        }

        // 2. If Long Press was just triggered, do nothing (prevent click)
        if (isLongPressTriggered.current) return;

        // 3. Normal Click Behavior
        // Desktop: Edit directly
        if (window.innerWidth >= 1024) {
            onEdit(transaction);
        } else {
            // Mobile: Toggle Expand
            setIsExpanded(!isExpanded);
        }
    };





    // Unified Flag for Styling
    const isLinkedTransfer = isTransfer && ((toAsset) || (fromAsset && !toAsset));

    // V3 Deduplication Logic:
    // MOVED: Now handled in TransactionList.tsx pre-filtering to avoid Virtualization glitches.


    return (
        <div
            className={`w-full relative group transition-all duration-200
            ${isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50/30'}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
        >
            {/* Main Row */}
            <div
                className="grid grid-cols-[auto_50px_1fr_auto] lg:grid-cols-[auto_60px_1.5fr_1.2fr_1fr] gap-2 py-3 px-4 items-center cursor-pointer"
                onClick={handleRowClick}
            >
                {/* Checkbox Column (Always present in grid to prevent jumping, but width goes to 0 if hidden) */}
                <div className={`overflow-hidden transition-all duration-300 ease-spring ${isSelectionMode ? 'w-6 opacity-100 mr-2' : 'w-0 opacity-0 group-hover:w-6 group-hover:opacity-100 mr-0 group-hover:mr-2'}`}>
                    <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleSelect) onToggleSelect();
                        }}
                    >
                        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                </div>

                {/* Col 1: Time */}
                <div className="text-center">
                    <span className="text-xs font-bold text-slate-400 font-mono tracking-tighter block opacity-60">{timeStr}</span>
                </div>

                {/* Col 2: Merchant & Memo & Asset (Mobile Center: 2 Columns) */}
                <div className="min-w-0 flex items-center justify-between gap-2 pr-1">
                    {/* Inner Col 1: Text Info */}
                    <div className="flex flex-col overflow-hidden">
                        <p className={`font-bold text-[15px] truncate leading-tight ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                            {mainText || <span className="text-slate-400 font-normal italic">No Description</span>}
                        </p>

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
                                <div className="flex items-center gap-1">
                                    <span>{categoryEmoji}</span>
                                    <span>{categoryName}</span>
                                </div>
                            )}

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
                                <span key={idx} className="text-[11px] text-blue-500 font-medium bg-blue-50 px-1 rounded-md cursor-pointer hover:bg-blue-100 transition-colors">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>


                    {/* Inner Col 2: Asset Name Badge (Mobile Only) */}
                    <div className="lg:hidden shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5">
                            {asset?.name || 'Unknown'}
                        </span>
                    </div>
                </div>

                {/* Col 3: Center 2 (Desktop Only - Category, Asset, Installment Badge) */}
                <div className="hidden lg:flex flex-nowrap gap-2 items-center">
                    <span className={`px-2 py-0.5 bg-slate-50/50 border border-slate-100 ${categoryColorClass} rounded-md text-[11px] font-bold whitespace-nowrap flex items-center h-fit shrink-0 gap-1`}>
                        <span>{categoryEmoji}</span>
                        <span>{categoryName}</span>
                    </span>
                    {transaction.installment && (
                        <span className="px-2 py-0.5 bg-blue-50/50 text-blue-600 rounded-md text-[10px] font-bold whitespace-nowrap flex items-center h-fit shrink-0">
                            {transaction.installment.totalMonths}개월
                        </span>
                    )}
                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap px-1 shrink-0 truncate max-w-[120px]">
                        {asset?.name || 'Unknown'}
                    </span>
                </div>

                {/* Col 4: Amount & Installment Info (Right) */}
                <div className="text-right flex flex-col items-end min-w-0">
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
                        <p className={`font-bold text-[15px] tabular-nums tracking-tight ${amountColor}`}>
                            {amountSign}{formattedAmount}
                        </p>
                    )}

                    {/* Installment Monthly Amount (Visible on Mobile & Desktop) */}
                    {transaction.installment && transaction.installment.totalMonths > 1 && (
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                            (월 {Math.round(transaction.amount / transaction.installment.totalMonths).toLocaleString()})
                        </p>
                    )}
                </div>
            </div>

            {/* Mobile Expanded Details */}
            {isExpanded && !isSelectionMode && (
                <div className="lg:hidden px-4 pb-3 pt-0 bg-slate-50/30 animate-in slide-in-from-top-1">
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
                                    {transaction.installment.totalMonths}개월 할부
                                </span>
                                {transaction.installment.isInterestFree && (
                                    <span className="px-2 py-1 h-fit bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center">
                                        무이자
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
                        <Button
                            onClick={(e) => { e.stopPropagation(); if (isConfirmingDelete) onDelete(transaction); else setIsConfirmingDelete(true); }}
                            size="sm"
                            className={`rounded-xl text-xs font-bold shadow-sm transition-colors h-auto py-1.5 ${isConfirmingDelete
                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                : 'bg-white border border-rose-100 text-rose-600 hover:bg-rose-50'
                                }`}
                        >
                            {isConfirmingDelete ? 'Confirm Delete' : 'Delete'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(TransactionItem);

import React from 'react';
import { Transaction, TransactionType, Asset, CategoryItem } from '../types';
import { Button } from './ui/Button';

interface TransactionItemProps {
    transaction: Transaction;
    asset?: Asset;
    toAsset?: Asset; // For transfers
    categories: CategoryItem[];
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
    transaction,
    asset,
    toAsset,
    categories = [],
    onEdit,
    onDelete
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

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
        amountColor = 'text-blue-600';
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
        // Desktop: Edit directly
        if (window.innerWidth >= 1024) {
            onEdit(transaction);
        } else {
            // Mobile: Toggle Expand
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div className="bg-white border-b border-slate-100 last:border-0 transition-all hover:bg-slate-50">
            {/* Main Row */}
            <div
                className="grid grid-cols-[50px_1fr_auto] lg:grid-cols-[60px_1.5fr_1.2fr_1fr] gap-2 py-3 px-4 items-center cursor-pointer"
                onClick={handleRowClick}
            >
                {/* Col 1: Time */}
                <div className="text-center">
                    <span className="text-xs font-bold text-slate-400 font-mono tracking-tighter block">{timeStr}</span>
                </div>

                {/* Col 2: Merchant & Memo & Asset (Mobile Center: 2 Columns) */}
                <div className="min-w-0 flex items-center justify-between gap-2 pr-1">
                    {/* Inner Col 1: Text Info */}
                    <div className="flex flex-col overflow-hidden">
                        <p className="font-bold text-slate-900 text-[15px] truncate leading-tight">
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
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {asset?.name || 'Unknown'}
                        </span>
                    </div>
                </div>

                {/* Col 3: Center 2 (Desktop Only - Category, Asset, Installment Badge) */}
                <div className="hidden lg:flex flex-nowrap gap-2 items-center">
                    <span className={`px-2 py-1 bg-white border border-slate-200 ${categoryColorClass} rounded-lg text-[10px] font-bold whitespace-nowrap flex items-center h-fit shrink-0 gap-1`}>
                        <span>{categoryEmoji}</span>
                        <span>{categoryName}</span>
                    </span>
                    {transaction.installment && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold whitespace-nowrap border border-blue-100 flex items-center h-fit shrink-0">
                            {transaction.installment.totalMonths}개월 할부
                        </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap px-1 shrink-0 truncate max-w-[120px]">
                        {asset?.name || 'Unknown'}
                    </span>
                </div>

                {/* Col 4: Amount & Installment Info (Right) */}
                <div className="text-right flex flex-col items-end min-w-0">
                    <p className={`font-bold text-[15px] tabular-nums tracking-tight ${amountColor}`}>
                        {amountSign}{formattedAmount}
                    </p>

                    {/* Installment Monthly Amount (Visible on Mobile & Desktop) */}
                    {transaction.installment && transaction.installment.totalMonths > 1 && (
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                            (월 {Math.round(transaction.amount / transaction.installment.totalMonths).toLocaleString()})
                        </p>
                    )}
                </div>
            </div>

            {/* Mobile Expanded Details */}
            {isExpanded && (
                <div className="lg:hidden px-4 pb-3 pt-0 bg-slate-50/50 border-t border-slate-100/50 animate-in slide-in-from-top-1">
                    <div className="flex flex-wrap gap-2 my-2">
                        {/* Mobile Expanded: Memo (Moved here) */}
                        {transaction.merchant && transaction.memo && (
                            <div className="w-fit max-w-full text-[10px] text-amber-700 mb-0 px-2 py-1 bg-amber-50 border border-amber-100/50 rounded-lg break-words shadow-sm flex items-center">
                                <span className="font-bold mr-1 text-amber-600/70 shrink-0">Memo</span>
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



                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button
                            onClick={(e) => { e.stopPropagation(); onEdit(transaction); }}
                            variant="outline"
                            size="sm"
                            className="rounded-2xl text-xs font-bold shadow-sm h-auto py-1.5"
                        >
                            Edit
                        </Button>
                        <Button
                            onClick={(e) => { e.stopPropagation(); if (isConfirmingDelete) onDelete(transaction); else setIsConfirmingDelete(true); }}
                            size="sm"
                            className={`rounded-2xl text-xs font-bold shadow-sm transition-colors h-auto py-1.5 ${isConfirmingDelete
                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                : 'bg-white border border-rose-100 text-rose-600 hover:bg-rose-50'
                                }`}
                        >
                            {isConfirmingDelete ? 'Confirm Delete' : 'Delete'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Desktop Hover Actions (Positioned absolute or integrated?) 
                Actually, simpler to just keep the original delete button logic for Desktop 
                or put it in the 4th column. 
                Let's add a subtle delete button on Desktop hover in 4th col.
            */}
            <div className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* ... can be added later if needed, but current layout covers info. */}
            </div>
        </div>
    );
};

export default TransactionItem;

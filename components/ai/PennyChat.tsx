import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send,
    X,
    Sparkles,
    Trash2,
    Edit2,
    PlusCircle,
    RefreshCw,
    AlertCircle,
    BrainCircuit,
    User,
    Check
} from 'lucide-react';
import { GeminiService } from '../../services/geminiService';
import { TransactionService } from '../../services/transactionService';
import { Transaction, Asset, CategoryItem, TransactionType } from '../../types';
import { Button } from '../ui/Button';
import { useToast } from '../../contexts/ToastContext';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    action?: {
        type: 'CREATE' | 'UPDATE' | 'DELETE' | 'NONE';
        payload: any;
        confirmationRequired: boolean;
        status?: 'pending' | 'confirmed' | 'cancelled';
    };
}

interface PennyChatProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    assets: Asset[];
    categories: CategoryItem[];
    onActionSuccess: () => void;
}

export const PennyChat: React.FC<PennyChatProps> = ({
    isOpen,
    onClose,
    transactions,
    assets,
    categories,
    onActionSuccess
}) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: '안녕하세요! 저는 Penny입니다. 귀하의 지출 내역을 기반으로 분석을 도와드리거나, 내역을 직접 수정해 드릴 수 있어요. 어떤 도움이 필요하신가요?'
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { addToast } = useToast();

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const context = { transactions, assets, categories };
            const result = await GeminiService.processPennyRequest(input, context);

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: result.answer,
                action: result.action?.type !== 'NONE' ? {
                    ...result.action,
                    status: 'pending'
                } : undefined
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Penny AI Error:', error);
            addToast('AI 분석 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmAction = async (messageId: string, action: any) => {
        try {
            setIsLoading(true);
            const { type, payload } = action;

            if (type === 'DELETE') {
                await TransactionService.deleteTransaction(payload.id);
                addToast('내역을 삭제했습니다.', 'success');
            } else if (type === 'UPDATE') {
                // Fetch the original transaction to get all fields or just update partial
                // For safety, assume payload has enough data for upsert if it's an update
                // But TransactionService.saveTransaction expects a full Transaction object.
                // Better to find the transaction in our context first.
                const original = transactions.find(t => t.id === payload.id);
                if (original) {
                    const updated: Transaction = {
                        ...original,
                        ...payload,
                        // Ensure category ID vs Name mapping if needed
                        category: payload.category_id || payload.category || original.category
                    };
                    await TransactionService.saveTransaction(updated);
                    addToast('내역을 수정했습니다.', 'success');
                }
            } else if (type === 'CREATE') {
                const newTx: any = {
                    id: crypto.randomUUID(),
                    date: payload.date || new Date().toISOString().split('T')[0],
                    amount: payload.amount,
                    type: payload.type || TransactionType.EXPENSE,
                    category: payload.category_id || categories[0].id,
                    assetId: payload.asset_id || assets[0].id,
                    memo: payload.memo || payload.merchant || 'AI로 생성된 내역',
                    timestamp: new Date().toISOString()
                };
                await TransactionService.saveTransaction(newTx);
                addToast('새 내역을 추가했습니다.', 'success');
            }

            // Update message status
            setMessages(prev => prev.map(m =>
                m.id === messageId && m.action
                    ? { ...m, action: { ...m.action, status: 'confirmed' } }
                    : m
            ));

            onActionSuccess(); // Refresh data
        } catch (error) {
            console.error('Action Error:', error);
            addToast('요청을 처리하지 못했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelAction = (messageId: string) => {
        setMessages(prev => prev.map(m =>
            m.id === messageId && m.action
                ? { ...m, action: { ...m.action, status: 'cancelled' } }
                : m
        ));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
                    />

                    {/* Chat Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                            <div className="flex items-center gap-3">
                                <span className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/10 border border-primary/20">
                                    <BrainCircuit size={24} />
                                </span>
                                <div>
                                    <h2 className="text-lg font-black tracking-tight">Penny AI</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial Data Analyst</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                            {messages.map((message) => (
                                <div key={message.id} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${message.role === 'user'
                                            ? 'bg-primary text-white rounded-tr-none'
                                            : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            {message.role === 'assistant' ? <BrainCircuit size={12} className="opacity-50" /> : <User size={12} className="opacity-50" />}
                                            <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">
                                                {message.role === 'assistant' ? 'Penny' : 'You'}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                    </div>

                                    {/* Action Card */}
                                    {message.action && message.action.type !== 'NONE' && (
                                        <div className="mt-2 w-[85%] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg animate-in slide-in-from-top-2">
                                            <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {message.action.type === 'DELETE' && <Trash2 size={14} className="text-rose-500" />}
                                                    {message.action.type === 'UPDATE' && <Edit2 size={14} className="text-blue-500" />}
                                                    {message.action.type === 'CREATE' && <PlusCircle size={14} className="text-emerald-500" />}
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        {message.action.type} Action
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${message.action.status === 'confirmed' ? 'bg-emerald-500' : message.action.status === 'cancelled' ? 'bg-slate-300' : 'bg-amber-500 animate-pulse'}`} />
                                                    <span className="text-[10px] font-bold text-slate-400 capitalize">{message.action.status}</span>
                                                </div>
                                            </div>

                                            <div className="p-4">
                                                {/* Action Details Preview */}
                                                <div className="text-xs space-y-2 mb-4">
                                                    {message.action.type === 'DELETE' && (
                                                        <p className="text-slate-600">트랜잭션을 데이터베이스에서 영구적으로 삭제합니다.</p>
                                                    )}
                                                    {message.action.type === 'UPDATE' && (
                                                        <div className="space-y-1">
                                                            {message.action.payload.category_id && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">카테고리:</span>
                                                                    <span className="font-bold text-blue-600">{categories.find(c => c.id === message.action?.payload.category_id)?.name || 'Unknown'}</span>
                                                                </div>
                                                            )}
                                                            {message.action.payload.amount && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">금액:</span>
                                                                    <span className="font-bold text-rose-600">{message.action.payload.amount.toLocaleString()}원</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {message.action.type === 'CREATE' && (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-400">내용:</span>
                                                                <span className="font-bold">{message.action.payload.memo || message.action.payload.merchant}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-400">금액:</span>
                                                                <span className="font-bold text-rose-600">{message.action.payload.amount.toLocaleString()}원</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {message.action.status === 'pending' && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="secondary"
                                                            className="flex-1 h-9 text-xs"
                                                            onClick={() => handleCancelAction(message.id)}
                                                        >
                                                            취소
                                                        </Button>
                                                        <Button
                                                            variant="primary"
                                                            className="flex-1 h-9 text-xs gap-1.5"
                                                            onClick={() => handleConfirmAction(message.id, message.action)}
                                                        >
                                                            <Check size={14} /> 확인
                                                        </Button>
                                                    </div>
                                                )}
                                                {message.action.status === 'confirmed' && (
                                                    <div className="flex items-center justify-center gap-2 py-1 text-emerald-600 font-bold text-xs bg-emerald-50 rounded-lg border border-emerald-100">
                                                        <Check size={14} /> 완료됨
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-start gap-2 animate-in fade-in">
                                    <div className="p-3 bg-white rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-3">
                                        <RefreshCw size={16} className="text-primary animate-spin" />
                                        <span className="text-sm font-bold text-slate-400">Penny가 분석 중...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-5 border-t border-slate-100 bg-white">
                            <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-2 pl-4 border border-slate-200 focus-within:bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="무엇이든 물어보세요..."
                                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder:text-slate-400 resize-none h-10 py-2 scrollbar-hide"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading}
                                    className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-2 text-center font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                <Sparkles size={10} className="text-primary" /> Powered by Gemini
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

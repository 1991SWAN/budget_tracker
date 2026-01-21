import { useState, useRef } from 'react';
import { RecurringTransaction, SavingsGoal, Asset, Category, BillType, AssetType } from '../types';

export type ModalType = 'bill' | 'goal' | 'pay-bill' | 'fund-goal' | 'budget' | 'pay-card' | 'import' | null;

export const useModalManager = (assets: Asset[]) => {
    const [modalType, setModalType] = useState<ModalType>(null);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState<any>({});

    // Payment Specific State
    const [paymentAsset, setPaymentAsset] = useState<string>('');
    const [destinationAsset, setDestinationAsset] = useState<string>('');
    const [paymentError, setPaymentError] = useState<string | null>(null);

    // Modal Ref for click-outside (handled by useModalClose in App, but ref can be here or there)
    // We'll leave the ref in App or pass it out.

    // --- Open Handlers ---

    const openAddBill = () => {
        setModalType('bill');
        setSelectedItem(null);
        setFormData({ name: '', amount: '', dayOfMonth: 1, category: Category.UTILITIES, billType: BillType.SUBSCRIPTION });
    };

    const openEditBill = (bill: RecurringTransaction) => {
        setModalType('bill');
        setSelectedItem(bill);
        setFormData({ ...bill });
    };

    const openPayBill = (bill: RecurringTransaction) => {
        setModalType('pay-bill');
        setSelectedItem(bill);
        // Auto-select first non-credit asset
        setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || '');
        setPaymentError(null);
    };

    const openAddGoal = () => {
        setModalType('goal');
        setSelectedItem(null);
        setFormData({ name: '', targetAmount: '', emoji: '🎯', deadline: '' });
    };

    const openEditGoal = (goal: SavingsGoal) => {
        setModalType('goal');
        setSelectedItem(goal);
        setFormData({ ...goal });
    };

    const openFundGoal = (goal: SavingsGoal) => {
        setModalType('fund-goal');
        setSelectedItem(goal);
        setFormData({ amount: '' });
        setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || '');
        setDestinationAsset('');
        setPaymentError(null);
    };

    const openEditBudget = (currentBudget: number) => {
        setModalType('budget');
        setSelectedItem(null);
        setFormData({ amount: currentBudget });
    };

    const openPayCard = (card: Asset) => {
        setModalType('pay-card');
        setSelectedItem(card);
        setFormData({
            amount: Math.abs(card.balance),
            date: new Date().toISOString().split('T')[0],
            memo: `Credit Card Payoff: ${card.name}`,
            category: Category.TRANSFER
        });
        setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || '');
        setPaymentError(null);
    };

    const openImport = () => {
        setModalType('import');
        setSelectedItem(null);
        setFormData({});
    };

    const closeModal = () => {
        setModalType(null);
        setSelectedItem(null);
        setPaymentError(null);
        setFormData({});
    };

    return {
        // State
        modalType, setModalType,
        selectedItem, setSelectedItem,
        formData, setFormData,
        paymentAsset, setPaymentAsset,
        destinationAsset, setDestinationAsset,
        paymentError, setPaymentError,

        // Actions
        openAddBill,
        openEditBill,
        openPayBill,
        openAddGoal,
        openEditGoal,
        openFundGoal,
        openEditBudget,
        openPayCard,
        openImport,
        closeModal
    };
};

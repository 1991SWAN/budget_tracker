import { useState } from 'react';
import { RecurringTransaction, SavingsGoal, Asset, BillType, AssetType, CategoryItem } from '../types';
import { getDefaultCategoryId } from '../utils/category';
import {
    createBillModalForm,
    createBudgetModalForm,
    createFundGoalModalForm,
    createGoalModalForm,
    createImportModalForm,
    createPayCardModalForm,
    ModalFormData,
    ModalSelectedItem,
    ModalType,
    toBillModalForm,
    toGoalModalForm,
} from './modalTypes';

export const useModalManager = (assets: Asset[], categories: CategoryItem[]) => {
    const [modalType, setModalType] = useState<ModalType>(null);
    const [selectedItem, setSelectedItem] = useState<ModalSelectedItem>(null);

    // Form State
    const [formData, setFormData] = useState<ModalFormData>(createImportModalForm());

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
        setFormData(createBillModalForm(
            getDefaultCategoryId(categories, 'EXPENSE', ['Housing & Bill', 'Other'])
        ));
    };

    const openEditBill = (bill: RecurringTransaction) => {
        setModalType('bill');
        setSelectedItem(bill);
        setFormData(toBillModalForm(bill));
    };

    const openPayBill = (bill: RecurringTransaction) => {
        setModalType('pay-bill');
        setSelectedItem(bill);
        setFormData(createImportModalForm());
        // Auto-select first non-credit asset
        setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || '');
        setPaymentError(null);
    };

    const openAddGoal = () => {
        setModalType('goal');
        setSelectedItem(null);
        setFormData(createGoalModalForm());
    };

    const openEditGoal = (goal: SavingsGoal) => {
        setModalType('goal');
        setSelectedItem(goal);
        setFormData(toGoalModalForm(goal));
    };

    const openFundGoal = (goal: SavingsGoal) => {
        setModalType('fund-goal');
        setSelectedItem(goal);
        setFormData(createFundGoalModalForm());
        setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || '');
        setDestinationAsset('');
        setPaymentError(null);
    };

    const openEditBudget = (currentBudget: number) => {
        setModalType('budget');
        setSelectedItem(null);
        setFormData(createBudgetModalForm(currentBudget));
    };

    const openPayCard = (card: Asset) => {
        setModalType('pay-card');
        setSelectedItem(card);
        setFormData(createPayCardModalForm(
            card,
            getDefaultCategoryId(categories, 'TRANSFER', ['Card Payment', 'Savings/Invest'])
        ));
        setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || '');
        setPaymentError(null);
    };

    const openImport = () => {
        setModalType('import');
        setSelectedItem(null);
        setFormData(createImportModalForm());
    };

    const closeModal = () => {
        setModalType(null);
        setSelectedItem(null);
        setPaymentError(null);
        setFormData(createImportModalForm());
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

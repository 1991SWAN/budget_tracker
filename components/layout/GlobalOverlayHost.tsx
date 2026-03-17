import React, { Suspense, lazy } from 'react';
import { Asset, CategoryItem, Transaction } from '../../types';
import type { ModalContainerProps } from './ModalContainer';

const LazyModalContainer = lazy(async () => {
    const module = await import('./ModalContainer');
    return { default: module.ModalContainer };
});

const LazyReconciliationModal = lazy(async () => {
    const module = await import('../ReconciliationModal');
    return { default: module.ReconciliationModal };
});

const LazyImportWizardModal = lazy(async () => {
    const module = await import('../import/ImportWizardModal');
    return { default: module.ImportWizardModal };
});

const LazySmartInput = lazy(() => import('../SmartInput'));

const LazyPennyChat = lazy(async () => {
    const module = await import('../ai/PennyChat');
    return { default: module.PennyChat };
});

interface GlobalOverlayHostProps {
    modalHost: ModalContainerProps;
    reconciliation: {
        isOpen: boolean;
        onClose: () => void;
        candidates: any[];
        singleCandidates: any[];
        assets: Asset[];
        categories: CategoryItem[];
        onLink: (candidate: any) => Promise<void> | void;
        onConvert: (candidate: any) => Promise<void> | void;
        onIgnore: (id: string, isSingle?: boolean) => Promise<void> | void;
    };
    importWizard: {
        isOpen: boolean;
        onClose: () => void;
        onConfirm: (transactions: Transaction[]) => Promise<void> | void;
        assetId: string;
        assetName: string;
        assets: Asset[];
        categories: CategoryItem[];
        initialFile?: File;
    };
    smartInput: {
        isOpen: boolean;
        onTransactionsParsed: (transactions: Partial<Transaction>[]) => Promise<void> | void;
        onCancel: () => void;
        assets: Asset[];
        categories: CategoryItem[];
        initialData?: Transaction | null;
        transactions: Transaction[];
        onDelete: (transactionId: string) => void;
    };
    pennyChat: {
        isOpen: boolean;
        onClose: () => void;
        categories: CategoryItem[];
        onSubmitPrompt: (input: string) => Promise<any>;
        onConfirmAction: (action: any) => Promise<void>;
    };
}

export const GlobalOverlayHost: React.FC<GlobalOverlayHostProps> = ({
    modalHost,
    reconciliation,
    importWizard,
    smartInput,
    pennyChat
}) => {
    const overlayLoader = (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-white" />
        </div>
    );

    return (
        <>
            {modalHost.modalType && (
                <Suspense fallback={overlayLoader}>
                    <LazyModalContainer {...modalHost} />
                </Suspense>
            )}

            {reconciliation.isOpen && (
                <Suspense fallback={overlayLoader}>
                    <LazyReconciliationModal {...reconciliation} />
                </Suspense>
            )}

            {importWizard.isOpen && (
                <Suspense fallback={overlayLoader}>
                    <LazyImportWizardModal
                        isOpen={importWizard.isOpen}
                        onClose={importWizard.onClose}
                        onConfirm={importWizard.onConfirm}
                        assetId={importWizard.assetId}
                        assetName={importWizard.assetName}
                        assets={importWizard.assets}
                        categories={importWizard.categories}
                        initialFile={importWizard.initialFile}
                    />
                </Suspense>
            )}

            {smartInput.isOpen && (
                <Suspense fallback={overlayLoader}>
                    <LazySmartInput
                        onTransactionsParsed={smartInput.onTransactionsParsed}
                        onCancel={smartInput.onCancel}
                        assets={smartInput.assets}
                        categories={smartInput.categories}
                        initialData={smartInput.initialData}
                        transactions={smartInput.transactions}
                        onDelete={transaction => smartInput.onDelete(transaction.id)}
                    />
                </Suspense>
            )}

            {pennyChat.isOpen && (
                <Suspense fallback={overlayLoader}>
                    <LazyPennyChat {...pennyChat} />
                </Suspense>
            )}
        </>
    );
};

import { useCallback, useState } from 'react';
import { ColumnMapping, ImportService } from '../services/importService';
import { TransactionService } from '../services/transactionService';

export const useImportWizardReconciliation = (rawData: any[][], headerIndex: number) => {
    const [dbHashBank, setDbHashBank] = useState<Set<string>>(new Set());
    const [reconciliationCandidates, setReconciliationCandidates] = useState<any[]>([]);
    const [isLoadingDb, setIsLoadingDb] = useState(false);

    const resetDbContext = useCallback(() => {
        setDbHashBank(new Set());
        setReconciliationCandidates([]);
        setIsLoadingDb(false);
    }, []);

    const loadDbContextForMapping = useCallback(async (candidateMapping: ColumnMapping) => {
        if (candidateMapping.dateIndex === -1 || rawData.length <= headerIndex + 1) {
            const emptyHashes = new Set<string>();
            setDbHashBank(emptyHashes);
            setReconciliationCandidates([]);
            return { hashes: emptyHashes, candidates: [] as any[] };
        }

        setIsLoadingDb(true);
        try {
            let minDateStr = '';
            let maxDateStr = '';

            for (let i = headerIndex + 1; i < rawData.length; i++) {
                const cell = rawData[i][candidateMapping.dateIndex];
                if (!cell) continue;

                const date = ImportService.parseLooseDate(cell);
                if (date) {
                    const iso = date.toISOString().split('T')[0];
                    if (!minDateStr || iso < minDateStr) minDateStr = iso;
                    if (!maxDateStr || iso > maxDateStr) maxDateStr = iso;
                }
            }

            if (!minDateStr || !maxDateStr) {
                const emptyHashes = new Set<string>();
                setDbHashBank(emptyHashes);
                setReconciliationCandidates([]);
                return { hashes: emptyHashes, candidates: [] as any[] };
            }

            const minDate = new Date(minDateStr);
            minDate.setDate(minDate.getDate() - 1);
            const maxDate = new Date(maxDateStr);
            maxDate.setDate(maxDate.getDate() + 1);

            const hashes = await TransactionService.getHashKeysByDateRange(
                minDate.toISOString().split('T')[0],
                maxDate.toISOString().split('T')[0]
            );

            const lookbackDate = new Date(minDate);
            lookbackDate.setDate(lookbackDate.getDate() - 30);

            const candidates = await TransactionService.getTransactionsForImportReconciliation(
                lookbackDate.toISOString().split('T')[0],
                maxDate.toISOString().split('T')[0]
            );

            setDbHashBank(hashes);
            setReconciliationCandidates(candidates);

            return { hashes, candidates };
        } finally {
            setIsLoadingDb(false);
        }
    }, [headerIndex, rawData]);

    return {
        dbHashBank,
        reconciliationCandidates,
        isLoadingDb,
        resetDbContext,
        loadDbContextForMapping,
    };
};

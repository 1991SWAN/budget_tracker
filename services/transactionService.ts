import { supabase } from './dbClient';
import { Transaction, TransactionType } from '../types';

export const TransactionService = {
    getTransactions: async (): Promise<Transaction[]> => {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false })
                .range(from, from + step - 1);

            if (error) {
                console.error('Error fetching transactions:', error);
                return [];
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }

            if (from >= 10000) {
                console.warn('[TransactionService] Pagination reached safety limit (10k).');
                break;
            }
        }

        const txAssetMap = new Map<string, string>();
        allData.forEach((row: any) => {
            if (row.id && row.asset_id) {
                txAssetMap.set(row.id, row.asset_id);
            }
        });

        return allData.map((row: any) => ({
            ...row,
            amount: Number(row.amount),
            assetId: row.asset_id,
            toAssetId: row.to_asset_id,
            linkedTransactionId: row.linked_transaction_id,
            linkedTransactionSourceAssetId: row.linked_transaction_id ? txAssetMap.get(row.linked_transaction_id) : undefined,
            hashKey: row.hash_key,
            isReconciliationIgnored: !!row.is_reconciliation_ignored,
            installment: (row.installment_total_months > 1 || row.installment) ? {
                totalMonths: row.installment_total_months || row.installment?.totalMonths || row.installment?.total_months,
                currentMonth: row.installment_current_month || row.installment?.currentMonth || row.installment?.current_month || 1,
                isInterestFree: row.is_interest_free ?? row.installment?.isInterestFree ?? row.installment?.is_interest_free ?? true,
                remainingBalance: row.installment?.remainingBalance || row.installment?.remaining_balance || row.amount
            } : undefined
        })) as Transaction[];
    },

    saveTransaction: async (tx: Transaction) => {
        const { data: { user } } = await supabase.auth.getUser();
        const row = {
            id: tx.id,
            user_id: user?.id,
            date: tx.date,
            timestamp: tx.timestamp,
            amount: tx.amount,
            type: tx.type,
            category: tx.category,
            memo: tx.memo,
            asset_id: tx.assetId,
            to_asset_id: tx.toAssetId,
            linked_transaction_id: tx.linkedTransactionId,
            installment: tx.installment,
            installment_total_months: tx.installment?.totalMonths ?? null,
            installment_current_month: tx.installment?.currentMonth ?? null,
            is_interest_free: tx.installment?.isInterestFree ?? null,
            is_reconciliation_ignored: tx.isReconciliationIgnored ?? false,
            hash_key: tx.hashKey || null
        };
        const { error } = await supabase.from('transactions').upsert(row);
        if (error) console.error('Error saving transaction:', error);
    },

    saveTransactions: async (txs: Transaction[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        const rows = txs.map(tx => ({
            id: tx.id,
            user_id: user?.id,
            date: tx.date,
            timestamp: tx.timestamp,
            amount: tx.amount,
            type: tx.type,
            category: tx.category,
            memo: tx.memo,
            asset_id: tx.assetId,
            to_asset_id: tx.toAssetId,
            linked_transaction_id: tx.linkedTransactionId,
            installment: tx.installment,
            installment_total_months: tx.installment?.totalMonths ?? null,
            installment_current_month: tx.installment?.currentMonth ?? null,
            is_interest_free: tx.installment?.isInterestFree ?? null,
            is_reconciliation_ignored: tx.isReconciliationIgnored ?? false,
            hash_key: tx.hashKey || null
        }));
        const { error } = await supabase.from('transactions').upsert(rows);
        if (error) console.error('Error saving transactions:', error);
    },

    deleteTransaction: async (id: string) => {
        const { error, count } = await supabase.from('transactions').delete({ count: 'exact' }).eq('id', id);
        if (error) {
            console.error('Error deleting transaction:', error);
            throw error;
        } else if (count === 0) {
            throw new Error('No transaction deleted');
        }
    },

    deleteTransactions: async (ids: string[]) => {
        if (!ids || ids.length === 0) return;
        const { error } = await supabase.from('transactions').delete().in('id', ids);
        if (error) {
            console.error('Error deleting transactions:', error);
            throw error;
        }
    },

    deleteTransactionsByAsset: async (assetId: string) => {
        if (!assetId) return;
        const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .or(`asset_id.eq.${assetId},to_asset_id.eq.${assetId}`);

        if (deleteError) {
            console.error(`Error deleting transactions for asset ${assetId}:`, deleteError);
            throw deleteError;
        }

        const { count, error: countError } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .or(`asset_id.eq.${assetId},to_asset_id.eq.${assetId}`);

        if (countError) {
            console.error("Verification failed during clear history:", countError);
            return;
        }

        if (count === 0) {
            const { data: obData } = await supabase.from('asset_opening_balances').select('amount').eq('asset_id', assetId).maybeSingle();
            const initialBalance = obData ? Number(obData.amount) : 0;
            const { error: updateError } = await supabase.from('assets').update({ balance: initialBalance }).eq('id', assetId);
            if (updateError) console.error("Failed to reset asset balance:", updateError);
        }
    },

    linkTransactionsV3: async (sourceUpdate: Partial<Transaction>, targetUpdate: Partial<Transaction>) => {
        if (!sourceUpdate.id || !targetUpdate.id) throw new Error("IDs required for linking.");
        const { error: err1 } = await supabase.from('transactions').update({
            type: TransactionType.TRANSFER,
            linked_transaction_id: sourceUpdate.linkedTransactionId,
            to_asset_id: sourceUpdate.toAssetId,
            amount: sourceUpdate.amount
        }).eq('id', sourceUpdate.id);
        if (err1) throw err1;

        const { error: err2 } = await supabase.from('transactions').update({
            type: TransactionType.TRANSFER,
            linked_transaction_id: targetUpdate.linkedTransactionId,
            to_asset_id: null,
            amount: targetUpdate.amount
        }).eq('id', targetUpdate.id);
        if (err2) throw err2;
    }
};

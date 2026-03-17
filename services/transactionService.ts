import { supabase } from './dbClient';
import { TagService } from './tagService';
import { Transaction, TransactionType, TransactionFilters } from '../types';
import { getTransactionTagNames, parseTransactionDetailsInput } from '../utils/transactionDetails';

export const TransactionService = {
    getTransactions: async (limit: number = 50, offset: number = 0, filters?: TransactionFilters): Promise<Transaction[]> => {
        let query = supabase
            .from('transactions')
            .select('*, transaction_tags(tags(id, name))');

        // Apply Filters
        if (filters) {
            if (filters.searchTerm) {
                const safeSearchTerm = filters.searchTerm.trim().replace(/[,%()]/g, ' ');
                if (safeSearchTerm) {
                    query = query.or(`memo.ilike.%${safeSearchTerm}%,merchant.ilike.%${safeSearchTerm}%`);
                }
            }
            if (filters.categories && filters.categories.length > 0) {
                query = query.in('category', filters.categories);
            }
            if (filters.assets && filters.assets.length > 0) {
                const assetIds = filters.assets.join(',');
                query = query.or(`asset_id.in.(${assetIds}),to_asset_id.in.(${assetIds})`);
            }
            if (filters.dateRange) {
                if (filters.dateRange.start) query = query.gte('date', filters.dateRange.start);
                if (filters.dateRange.end) query = query.lte('date', filters.dateRange.end);
            }
            if (filters.type && filters.type !== 'ALL') {
                query = query.eq('type', filters.type);

                // Sub-filter for Expenses (Regular vs Installment)
                if (filters.type === TransactionType.EXPENSE && filters.expenseType && filters.expenseType !== 'ALL') {
                    if (filters.expenseType === 'INSTALLMENT') {
                        query = query.gt('installment_total_months', 1);
                    } else if (filters.expenseType === 'REGULAR') {
                        // Regular means either installment is 1 or null
                        query = query.or('installment_total_months.is.null,installment_total_months.eq.1');
                    }
                }
            }
        }

        const { data, error } = await query
            .order('date', { ascending: false })
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }

        const txAssetMap = new Map<string, string>();
        data.forEach((row: any) => {
            if (row.id && row.asset_id) {
                txAssetMap.set(row.id, row.asset_id);
            }
        });

        return data.map((row: any) => ({
            ...row,
            amount: Number(row.amount),
            assetId: row.asset_id,
            toAssetId: row.to_asset_id,
            linkedTransactionId: row.linked_transaction_id,
            linkedTransactionSourceAssetId: row.linked_transaction_id ? txAssetMap.get(row.linked_transaction_id) : undefined,
            hashKey: row.hash_key,
            merchant: row.merchant,
            tags: row.transaction_tags?.map((tt: any) => tt.tags).filter(Boolean) || [],
            isReconciliationIgnored: !!row.is_reconciliation_ignored,
            installment: (row.installment_total_months > 1 || row.installment) ? {
                totalMonths: row.installment_total_months || row.installment?.totalMonths || row.installment?.total_months,
                currentMonth: row.installment_current_month || row.installment?.currentMonth || row.installment?.current_month || 1,
                isInterestFree: row.is_interest_free ?? row.installment?.isInterestFree ?? row.installment?.is_interest_free ?? true,
                remainingBalance: row.installment?.remainingBalance || row.installment?.remaining_balance || row.amount
            } : undefined
        })) as Transaction[];
    },

    getInstallmentsByAsset: async (assetId: string): Promise<Transaction[]> => {
        const { data, error } = await supabase
            .from('transactions')
            .select('*, transaction_tags(tags(id, name))')
            .eq('asset_id', assetId)
            .gt('installment_total_months', 1)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching installments:', error);
            return [];
        }

        return data.map((row: any) => ({
            ...row,
            amount: Number(row.amount),
            assetId: row.asset_id,
            toAssetId: row.to_asset_id,
            linkedTransactionId: row.linked_transaction_id,
            hashKey: row.hash_key,
            merchant: row.merchant,
            tags: row.transaction_tags?.map((tt: any) => tt.tags).filter(Boolean) || [],
            isReconciliationIgnored: !!row.is_reconciliation_ignored,
            installment: {
                totalMonths: row.installment_total_months,
                currentMonth: row.installment_current_month || 1,
                isInterestFree: row.is_interest_free ?? true,
                remainingBalance: row.installment?.remainingBalance || row.installment?.remaining_balance || row.amount
            }
        })) as Transaction[];
    },

    getHashKeysByDateRange: async (startDate: string, endDate: string): Promise<Set<string>> => {
        const allHashKeys: string[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('transactions')
                .select('hash_key')
                .gte('date', startDate)
                .lte('date', endDate)
                .not('hash_key', 'is', null)
                .range(from, from + PAGE_SIZE - 1);

            if (error) {
                console.error('Error fetching hash keys:', error);
                break;
            }

            if (data && data.length > 0) {
                allHashKeys.push(...data.map((row: any) => row.hash_key));
                from += PAGE_SIZE;
                hasMore = data.length === PAGE_SIZE; // 1000건 미만이면 마지막 페이지
            } else {
                hasMore = false;
            }
        }

        return new Set(allHashKeys);
    },

    getTransactionsForImportReconciliation: async (startDate: string, endDate: string, assetIds?: string[]): Promise<any[]> => {
        const allCandidates: any[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('transactions')
                .select('id, asset_id, date, amount, type, memo, merchant, timestamp, hash_key')
                .gte('date', startDate)
                .lte('date', endDate)
                .range(from, from + PAGE_SIZE - 1);

            if (assetIds && assetIds.length > 0) {
                query = query.in('asset_id', assetIds);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching reconciliation candidates:', error);
                break;
            }

            if (data && data.length > 0) {
                allCandidates.push(...data);
                from += PAGE_SIZE;
                hasMore = data.length === PAGE_SIZE;
            } else {
                hasMore = false;
            }
        }

        return allCandidates;
    },

    saveTransaction: async (tx: Transaction) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const structuredTagNames = getTransactionTagNames(tx.tags);
        const structuredMerchant = tx.merchant?.trim() || null;
        const usesStructuredDetails = structuredTagNames.length > 0 || structuredMerchant !== null;
        const parsedDetails = usesStructuredDetails
            ? {
                memo: String(tx.memo || '').trim(),
                merchant: structuredMerchant,
                tags: structuredTagNames,
            }
            : (() => {
                const parsed = parseTransactionDetailsInput(tx.memo || '');
                return {
                    memo: parsed.memo,
                    merchant: parsed.merchant,
                    tags: parsed.tags,
                };
            })();

        const row = {
            id: tx.id,
            user_id: user.id,
            date: tx.date,
            timestamp: tx.timestamp,
            amount: tx.amount,
            type: tx.type,
            category: tx.category,
            memo: parsedDetails.memo,
            merchant: parsedDetails.merchant,
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
        if (error) {
            console.error('Error saving transaction:', error);
            return;
        }

        // 2. Handle Tags Many-to-Many
        // Always delete existing relationships first to ensure cleanup works even if all tags are removed
        await supabase.from('transaction_tags').delete().eq('transaction_id', tx.id);

        if (parsedDetails.tags.length > 0) {
            // Upsert each tag and collect their IDs
            const tagIds = await Promise.all(parsedDetails.tags.map(name => TagService.upsertTag(name)));
            const validTagIds = tagIds.filter(id => id !== null) as string[];

            if (validTagIds.length > 0) {
                const tagLinks = validTagIds.map(tagId => ({
                    transaction_id: tx.id,
                    tag_id: tagId,
                    user_id: user.id
                }));
                await supabase.from('transaction_tags').insert(tagLinks);
            }
            await TagService.cleanupOrphanTags();
        } else {
            // Even if no tags in memo, we should check for orphans after deletion
            await TagService.cleanupOrphanTags();
        }
    },

    saveTransactions: async (txs: Transaction[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const processedRows = await Promise.all(txs.map(async tx => {
            const structuredTagNames = getTransactionTagNames(tx.tags);
            const structuredMerchant = tx.merchant?.trim() || null;
            const usesStructuredDetails = structuredTagNames.length > 0 || structuredMerchant !== null;
            const parsedDetails = usesStructuredDetails
                ? {
                    memo: String(tx.memo || '').trim(),
                    merchant: structuredMerchant,
                    tags: structuredTagNames,
                }
                : (() => {
                    const parsed = parseTransactionDetailsInput(tx.memo || '');
                    return {
                        memo: parsed.memo,
                        merchant: parsed.merchant,
                        tags: parsed.tags,
                    };
                })();

            // Parallel tag upsert
            const tagIds = await Promise.all(parsedDetails.tags.map(name => TagService.upsertTag(name)));
            const validTagIds = tagIds.filter(id => id !== null) as string[];

            return {
                row: {
                    id: tx.id,
                    user_id: user.id,
                    date: tx.date,
                    timestamp: tx.timestamp,
                    amount: tx.amount,
                    type: tx.type,
                    category: tx.category,
                    memo: parsedDetails.memo,
                    merchant: parsedDetails.merchant,
                    asset_id: tx.assetId,
                    to_asset_id: tx.toAssetId,
                    linked_transaction_id: tx.linkedTransactionId,
                    installment: tx.installment,
                    installment_total_months: tx.installment?.totalMonths ?? null,
                    installment_current_month: tx.installment?.currentMonth ?? null,
                    is_interest_free: tx.installment?.isInterestFree ?? null,
                    is_reconciliation_ignored: tx.isReconciliationIgnored ?? false,
                    hash_key: tx.hashKey || null
                },
                tagIds: validTagIds
            };
        }));

        const rows = processedRows.map(p => p.row);
        const { error } = await supabase.from('transactions').upsert(rows);
        if (error) {
            console.error('Error saving transactions:', error);
            return;
        }

        // Handle Tags for all transactions
        for (const p of processedRows) {
            // Always delete existing relationships first to ensure cleanup
            await supabase.from('transaction_tags').delete().eq('transaction_id', p.row.id);

            if (p.tagIds.length > 0) {
                const tagLinks = p.tagIds.map(tagId => ({
                    transaction_id: p.row.id,
                    tag_id: tagId,
                    user_id: user.id
                }));
                await supabase.from('transaction_tags').insert(tagLinks);
            }
        }
        await TagService.cleanupOrphanTags();
    },

    deleteTransaction: async (id: string) => {
        const { error, count } = await supabase.from('transactions').delete({ count: 'exact' }).eq('id', id);
        if (error) {
            console.error('Error deleting transaction:', error);
            throw error;
        } else if (count === 0) {
            throw new Error('No transaction deleted');
        }

        await TagService.cleanupOrphanTags();
    },

    deleteTransactions: async (ids: string[]) => {
        if (!ids || ids.length === 0) return;
        const { error } = await supabase.from('transactions').delete().in('id', ids);
        if (error) {
            console.error('Error deleting transactions:', error);
            throw error;
        }

        await TagService.cleanupOrphanTags();
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
    },

    getReconciliationCandidates: async (windowMinutes: number = 2): Promise<{ pairs: any[], singles: any[] }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { pairs: [], singles: [] };

        const { data, error } = await supabase.rpc('find_reconciliation_candidates', {
            p_user_id: user.id,
            p_window_minutes: windowMinutes
        });

        if (error) {
            console.error('[TransactionService] RPC Error:', error);
            return { pairs: [], singles: [] };
        }

        console.log(`[TransactionService] RPC returned ${data?.pairs?.length || 0} pairs, ${data?.singles?.length || 0} singles for user ${user.id}`);

        if (!data) return { pairs: [], singles: [] };

        // Helper to map snake_case DB row to camelCase Transaction type
        const mapTx = (row: any) => {
            if (!row) return null;
            return {
                ...row,
                amount: Number(row.amount),
                assetId: row.asset_id || row.assetId,
                toAssetId: row.to_asset_id || row.toAssetId,
                linkedTransactionId: row.linked_transaction_id || row.linkedTransactionId,
                isReconciliationIgnored: !!(row.is_reconciliation_ignored || row.isReconciliationIgnored),
                installment: (row.installment_total_months > 1 || row.installment) ? {
                    totalMonths: row.installment_total_months || row.installment?.totalMonths || row.installment?.total_months,
                    currentMonth: row.installment_current_month || row.installment?.currentMonth || row.installment?.current_month || 1,
                    isInterestFree: row.is_interest_free ?? row.installment?.isInterestFree ?? row.installment?.is_interest_free ?? true,
                    remainingBalance: row.installment?.remainingBalance || row.installment?.remaining_balance || row.amount
                } : undefined
            };
        };

        const mappedPairs = (data.pairs || []).map((p: any) => {
            const withdrawal = mapTx(p.withdrawal || p.withdrawal);
            const deposit = mapTx(p.deposit || p.deposit);
            if (!withdrawal || !deposit) return null;

            return {
                ...p,
                withdrawal,
                deposit,
                timeDiff: Number(p.timeDiff || p.timediff || 0)
            };
        }).filter(Boolean);

        const mappedSingles = (data.singles || []).map((s: any) => {
            const rawTx = s.transaction || s.transaction;
            const rawAsset = s.targetAsset || s.targetasset;

            if (!rawTx || !rawAsset) return null;

            return {
                ...s,
                transaction: mapTx(rawTx),
                targetAsset: {
                    ...rawAsset,
                    userId: rawAsset.user_id || rawAsset.userId,
                    openingBalance: Number(rawAsset.opening_balance || rawAsset.openingBalance || 0)
                }
            };
        }).filter(Boolean);

        return { pairs: mappedPairs, singles: mappedSingles as any[] };
    }
};

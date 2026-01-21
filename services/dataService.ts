import { supabase } from './dbClient';
import { Asset, Transaction, RecurringTransaction, SavingsGoal, CategoryItem, Budget, Tag, TransactionType } from '../types';

export const DataService = {
    resetData: async (options: {
        transactions: boolean;
        assets: boolean;
        goals: boolean;
        recurring: boolean;
        categories: boolean;
        budgets: boolean;
        tags: boolean;
    }) => {
        const dummyId = '00000000-0000-0000-0000-000000000000';

        if (options.tags) await supabase.from('tags').delete().neq('id', dummyId);

        if (options.transactions) {
            if (!options.assets) {
                const { data: currentAssets } = await supabase.from('assets').select('id');
                const { data: openingBalances } = await supabase.from('asset_opening_balances').select('asset_id, amount');
                const obMap = new Map(openingBalances?.map(ob => [ob.asset_id, ob.amount]) || []);

                if (currentAssets) {
                    for (const row of currentAssets) {
                        const initialBalance = Number(obMap.get(row.id)) || 0;
                        await supabase.from('assets').update({ balance: initialBalance }).eq('id', row.id);
                    }
                }
            }
            await supabase.from('transactions').delete().neq('id', dummyId);
        }

        if (options.recurring) await supabase.from('recurring_transactions').delete().neq('id', dummyId);
        if (options.goals) await supabase.from('savings_goals').delete().neq('id', dummyId);
        if (options.budgets) await supabase.from('budgets').delete().neq('id', dummyId);

        if (options.assets) {
            await supabase.from('asset_opening_balances').delete().neq('id', dummyId);
            await supabase.from('assets').delete().neq('id', dummyId);
        }

        if (options.categories) await supabase.from('categories').delete().neq('id', dummyId);

    },

    getAllDataParallel: async () => {
        try {
            const [
                assetsResult,
                openingBalancesResult,
                transactionsResult,
                recurringResult,
                goalsResult,
                categoriesResult,
                budgetsResult,
                tagsResult,
                profileResult
            ] = await Promise.allSettled([
                supabase.from('assets').select('*'),
                supabase.from('asset_opening_balances').select('*'),
                supabase.from('transactions').select('*').order('date', { ascending: false }),
                supabase.from('recurring_transactions').select('*'),
                supabase.from('savings_goals').select('*'),
                supabase.from('categories').select('*').order('sort_order', { ascending: true }),
                supabase.from('budgets').select('*'),
                supabase.from('tags').select('*').order('usage_count', { ascending: false }),
                supabase.from('profiles').select('*').single()
            ]);

            const getData = (result: PromiseSettledResult<any>, name: string) => {
                if (result.status === 'fulfilled' && !result.value.error) return result.value.data;
                console.warn(`[DataService] Failed to fetch ${name}:`, result.status === 'fulfilled' ? result.value.error : result.reason);
                return [];
            };

            const assetsRows = getData(assetsResult, 'assets');
            const obData = getData(openingBalancesResult, 'opening_balances');
            const txRows = getData(transactionsResult, 'transactions');
            const recurringRows = getData(recurringResult, 'recurring');
            const goalRows = getData(goalsResult, 'goals');
            const categoryRows = getData(categoriesResult, 'categories');
            const budgetRows = getData(budgetsResult, 'budgets');
            const tagRows = getData(tagsResult, 'tags');

            let profileData = null;
            if (profileResult.status === 'fulfilled' && !profileResult.value.error) {
                const data = profileResult.value.data;
                profileData = {
                    ...data,
                    monthlyBudget: data.monthly_budget !== null ? Number(data.monthly_budget) : 2500000
                };
            }

            const txAssetMap = new Map<string, string>();
            txRows.forEach((row: any) => {
                if (row.id && row.asset_id) txAssetMap.set(row.id, row.asset_id);
            });

            const obMap = new Map(obData?.map((ob: any) => [ob.asset_id, Number(ob.amount)]) || []);




            return {
                assets: assetsRows.map((row: any) => ({
                    ...row,
                    balance: Number(row.balance),
                    creditDetails: row.credit_details,
                    loanDetails: row.loan_details,
                    interestRate: row.interest_rate,
                    billingCycle: row.credit_details?.billingCycle,
                    bankDetails: row.bank_details,
                    investmentDetails: row.investment_details,
                    institution: row.institution,
                    accountNumber: row.account_number,
                    excludeFromTotal: row.exclude_from_total,
                    theme: row.theme,
                    initialBalance: obMap.get(row.id) || 0,
                })) as Asset[],
                transactions: txRows.map((row: any) => ({
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
                })) as Transaction[],
                recurring: recurringRows.map((row: any) => ({
                    ...row,
                    amount: Number(row.amount),
                    dayOfMonth: row.day_of_month,
                    billType: row.bill_type,
                    installmentDetails: row.installment_details
                })) as RecurringTransaction[],
                goals: goalRows.map((row: any) => ({
                    ...row,
                    targetAmount: Number(row.target_amount),
                    currentAmount: Number(row.current_amount)
                })) as SavingsGoal[],
                categories: categoryRows.map((row: any) => ({
                    id: row.id,
                    user_id: row.user_id,
                    name: row.name,
                    emoji: row.emoji,
                    type: row.type,
                    is_default: row.is_default,
                    sort_order: row.sort_order,
                    color: row.color,
                    created_at: row.created_at
                })) as CategoryItem[],
                budgets: (budgetRows as Budget[]) || [],
                tags: tagRows as Tag[],
                profile: profileData
            };
        } catch (err) {
            console.error('[DataService] getAllDataParallel fatal error:', err);
            console.timeEnd('[DataService] getAllDataParallel');
            throw err;
        }
    },

    createTransferPair: async (sourceTx: Transaction, targetAssetId: string, categoryId: string) => {
        if (!sourceTx.id || !targetAssetId) throw new Error("Source Transaction and Target Asset ID required.");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Authentication required.");

        const targetTxId = crypto.randomUUID();

        // 1. Create Counterpart (Deposit side)
        const targetTx = {
            id: targetTxId,
            user_id: user.id,
            date: sourceTx.date,
            timestamp: sourceTx.timestamp,
            amount: sourceTx.amount, // Positive amount for the receiver
            type: TransactionType.TRANSFER,
            asset_id: targetAssetId,
            linked_transaction_id: sourceTx.id,
            category: categoryId,
            memo: sourceTx.memo
        };

        const { error: insertError } = await supabase.from('transactions').insert(targetTx);
        if (insertError) throw insertError;

        // 2. Update Source (Withdrawal side)
        const { error: updateError } = await supabase.from('transactions').update({
            type: TransactionType.TRANSFER,
            to_asset_id: targetAssetId,
            linked_transaction_id: targetTxId,
            category: categoryId
        }).eq('id', sourceTx.id);

        if (updateError) throw updateError;

        // NOTE: Manual balance updates removed. 
        // Database triggers will handle balance adjustments automatically based on the new transactions.
    }
};

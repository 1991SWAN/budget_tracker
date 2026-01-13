import { createClient } from '@supabase/supabase-js';
import { Asset, Transaction, RecurringTransaction, SavingsGoal, AssetType, Category, BillType, CategoryItem, Budget, Tag } from '../types';

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// --- Helper Types for DB Schema Mapping ---
// We use 'any' loosely here for DB responses to map back to strict domain types
// In a stricter setup, we would generate types from the DB schema.

export const SupabaseService = {
    // --- Assets ---
    getAssets: async (): Promise<Asset[]> => {
        console.log('[Supabase] getAssets called');
        const { data, error } = await supabase.from('assets').select('*');
        if (error) {
            console.error('Error fetching assets:', error);
            return [];
        }
        console.log('[Supabase] getAssets done. Count:', data?.length);
        return data.map((row: any) => ({
            ...row,
            balance: Number(row.balance), // Ensure number
            // Map JSON fields back to objects
            creditDetails: row.credit_details,
            loanDetails: row.loan_details,
            // Map snake_case to camelCase where needed if auto-map fails, 
            // but we kept most columns consistent or use renaming below
            interestRate: row.interest_rate,
            billingCycle: row.credit_details?.billingCycle, // Legacy support if needed

            // New Mappings
            bankDetails: row.bank_details,
            investmentDetails: row.investment_details,
            institution: row.institution,
            accountNumber: row.account_number,
            excludeFromTotal: row.exclude_from_total,
            theme: row.theme,
        })) as Asset[];
    },

    saveAsset: async (asset: Asset) => {
        const { data: { user } } = await supabase.auth.getUser();
        // Map domain model to DB Row
        const row = {
            id: asset.id,
            user_id: user?.id,
            name: asset.name,
            type: asset.type,
            balance: asset.balance,
            currency: asset.currency,
            description: asset.description,
            interest_rate: asset.interestRate,
            limit: asset.limit, // Mapped to "limit" column (quoted in SQL)
            // Store complex objects as JSON
            credit_details: asset.creditDetails,
            loan_details: asset.loanDetails,
            bank_details: asset.bankDetails,
            investment_details: asset.investmentDetails,

            // Common Extended Fields
            institution: asset.institution,
            account_number: asset.accountNumber,
            exclude_from_total: asset.excludeFromTotal,
            theme: asset.theme,
        };

        // Upsert (Insert or Update)
        const { error } = await supabase.from('assets').upsert(row);
        if (error) console.error('Error saving asset:', error);
    },

    deleteAsset: async (id: string) => {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) console.error('Error deleting asset:', error);
    },

    // --- Transactions ---
    getTransactions: async (): Promise<Transaction[]> => {
        console.log('[Supabase] getTransactions called');
        const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
        if (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
        console.log('[Supabase] getTransactions done. Count:', data?.length);
        return data.map((row: any) => ({
            ...row,
            amount: Number(row.amount),
            assetId: row.asset_id,
            toAssetId: row.to_asset_id,
            linkedTransactionId: row.linked_transaction_id,

            // Reconstruct Installment Object from Flat Columns (Preferred) or JSON (Fallback)
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

            // New Columns
            asset_id: tx.assetId,
            to_asset_id: tx.toAssetId,
            linked_transaction_id: tx.linkedTransactionId,

            // Legacy JSON (Keep for now or deprecate? Keep for backup)
            installment: tx.installment,

            // New Flattened Installment Columns
            installment_total_months: tx.installment?.totalMonths ?? null,
            installment_current_month: tx.installment?.currentMonth ?? null,
            is_interest_free: tx.installment?.isInterestFree ?? null
        };
        const { error } = await supabase.from('transactions').upsert(row);
        if (error) {
            console.error('Error saving transaction:', error);
        }
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

            // emoji: tx.emoji,
            asset_id: tx.assetId,
            to_asset_id: tx.toAssetId,
            linked_transaction_id: tx.linkedTransactionId,

            // Legacy JSON
            installment: tx.installment,

            // New Flattened Installment Columns
            installment_total_months: tx.installment?.totalMonths ?? null,
            installment_current_month: tx.installment?.currentMonth ?? null,
            is_interest_free: tx.installment?.isInterestFree ?? null
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

        const { error } = await supabase
            .from('transactions')
            .delete()
            .in('id', ids);

        if (error) {
            console.error('Error deleting transactions:', error);
            throw error;
        }
    },

    // --- Recurring ---
    getRecurring: async (): Promise<RecurringTransaction[]> => {
        const { data, error } = await supabase.from('recurring_transactions').select('*');
        if (error) {
            console.error('Error fetching recurring:', error);
            return [];
        }
        return data.map((row: any) => ({
            ...row,
            amount: Number(row.amount),
            dayOfMonth: row.day_of_month,
            billType: row.bill_type,
            installmentDetails: row.installment_details
        })) as RecurringTransaction[];
    },

    saveRecurring: async (item: RecurringTransaction) => {
        const { data: { user } } = await supabase.auth.getUser();
        const row = {
            id: item.id,
            user_id: user?.id,
            name: item.name,
            amount: item.amount,
            day_of_month: item.dayOfMonth,
            category: item.category,
            bill_type: item.billType,
            installment_details: item.installmentDetails
        };
        const { error } = await supabase.from('recurring_transactions').upsert(row);
        if (error) console.error('Error saving recurring:', error);
    },

    deleteRecurring: async (id: string) => {
        const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
        if (error) console.error('Error deleting recurring:', error);
    },

    // --- Goals ---
    getGoals: async (): Promise<SavingsGoal[]> => {
        const { data, error } = await supabase.from('savings_goals').select('*');
        if (error) {
            console.error('Error fetching goals:', error);
            return [];
        }
        return data.map((row: any) => ({
            ...row,
            targetAmount: Number(row.target_amount),
            currentAmount: Number(row.current_amount)
        })) as SavingsGoal[];
    },

    saveGoal: async (item: SavingsGoal) => {
        const { data: { user } } = await supabase.auth.getUser();
        const row = {
            id: item.id,
            user_id: user?.id,
            name: item.name,
            target_amount: item.targetAmount,
            current_amount: item.currentAmount,
            emoji: item.emoji,
            deadline: item.deadline
        };
        const { error } = await supabase.from('savings_goals').upsert(row);
        if (error) console.error('Error saving goal:', error);
    },

    deleteGoal: async (id: string) => {
        const { error } = await supabase.from('savings_goals').delete().eq('id', id);
        if (error) console.error('Error deleting goal:', error);
    },

    // --- Categories ---
    getCategories: async (): Promise<CategoryItem[]> => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true }); // Default to sort order

        if (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
        return data.map((row: any) => ({
            id: row.id,
            user_id: row.user_id,
            name: row.name,
            emoji: row.emoji,
            type: row.type,
            is_default: row.is_default,
            sort_order: row.sort_order,
            color: row.color,
            created_at: row.created_at
        })) as CategoryItem[];
    },

    saveCategory: async (item: CategoryItem) => {
        const row: any = {
            id: item.id,
            user_id: item.user_id,
            name: item.name,
            emoji: item.emoji,
            type: item.type,
            is_default: item.is_default,
            sort_order: item.sort_order,
            color: item.color
        };

        // Ensure we have a valid user_id
        if (!row.user_id) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                row.user_id = session.user.id;
            } else {
                // Try getUser as backup
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.id) {
                    row.user_id = user.id;
                } else {
                    console.warn("[Dev Mode] Using fallback UUID");
                    // Fallback to a placeholder UUID to satisfy NOT NULL constraint.
                    // Note: This will fail if RLS enforces auth.uid() = user_id strict check without a session.
                    row.user_id = '00000000-0000-0000-0000-000000000000';
                }
            }
        }

        // Remove ID if it's an empty string or nullish to allow DB generation 
        // (though robust client usually generates it)
        if (!row.id) delete row.id;

        const { error } = await supabase.from('categories').upsert(row);
        if (error) console.error('Error saving category:', error);
    },

    deleteCategory: async (id: string) => {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) console.error('Error deleting category:', error);
    },

    // --- Budgets ---
    getBudgets: async () => {
        const { data, error } = await supabase.from('budgets').select('*');
        if (error) console.error('Error fetching budgets:', error);
        return (data as Budget[]) || [];
    },

    saveBudget: async (budget: Partial<Budget>) => {
        const row: any = { ...budget };

        if (!row.user_id) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                row.user_id = session.user.id;
            }
        }

        if (!row.id) delete row.id;

        const { error } = await supabase.from('budgets').upsert(row);
        if (error) console.error('Error saving budget:', error);
        return { error };
    },

    deleteBudget: async (id: string) => {
        const { error } = await supabase.from('budgets').delete().eq('id', id);
        if (error) console.error('Error deleting budget:', error);
        return { error };
    },
    /* -------------------------------------------------------------------------- */
    /*                                 TAGS (DICTIONARY)                          */
    /* -------------------------------------------------------------------------- */

    getTags: async (): Promise<Tag[]> => {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .order('usage_count', { ascending: false });

        if (error) {
            console.error('Error fetching tags:', error);
            return [];
        }
        return data as Tag[];
    },

    upsertTag: async (tagName: string): Promise<void> => {
        if (!tagName) return;
        const cleanName = tagName.trim();

        try {
            // Check if tag exists
            const { data: existing } = await supabase
                .from('tags')
                .select('id, usage_count')
                .eq('name', cleanName)
                .maybeSingle();

            if (existing) {
                // Increment usage
                await supabase
                    .from('tags')
                    .update({ usage_count: existing.usage_count + 1 })
                    .eq('id', existing.id);
            } else {
                // Insert new
                await supabase
                    .from('tags')
                    .insert({ name: cleanName, usage_count: 1 });
            }
        } catch (err) {
            console.error('Error upserting tag:', err);
        }
    },
    // --- Data Management ---
    // --- Profile / Settings ---
    getProfile: async () => {
        try {
            const { data, error } = await supabase.from('profiles').select('*').single();
            if (error) {
                if (error.code === 'PGRST116') {
                    // No profile row exists yet. Return default partial profile.
                    // Returning 0 or null allows the App to decide, but we want to avoid the hardcoded 2.5M override if the user intended 0.
                    // For now, let's suggest the migration default (2.5M) OR just return empty so App initializes.
                    // However, to fix the specific user complaint ("keeps filling 2.5M"), we should trust the DB.
                    // If DB has no row, it effectively has no setting.
                    return null; // App will use fallback
                }
                console.error('Error fetching profile:', error);
                return null;
            }
            return {
                ...data,
                // Fix: Ensure 0 is treated as 0, not falsey falling back to default
                monthlyBudget: data.monthly_budget !== null ? Number(data.monthly_budget) : 2500000
            };
        } catch (err) {
            console.error("Unexpected error in getProfile", err);
            return null;
        }
    },

    saveProfile: async (updates: { monthly_budget?: number, theme?: string }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('profiles').upsert({
            id: user.id,
            ...updates,
            updated_at: new Date().toISOString()
        });

        if (error) console.error('Error saving profile:', error);
    },

    // --- Data Management ---
    resetData: async (options: {
        transactions: boolean;
        assets: boolean;
        goals: boolean;
        recurring: boolean;
        categories: boolean;
        budgets: boolean;
        tags: boolean;
    }) => {
        // Order matters due to Foreign Keys. 
        // We generally delete child records first.

        const dummyId = '00000000-0000-0000-0000-000000000000';

        if (options.tags) {
            await supabase.from('tags').delete().neq('id', dummyId);
        }

        if (options.transactions) {
            // Smart Reset: Calculate net transaction effect per asset and revert it to preserve 'Initial Balance'.
            // 1. Fetch all transactions (lightweight, only needed fields)
            const { data: allTxs } = await supabase.from('transactions').select('asset_id, to_asset_id, amount, type');

            if (allTxs && allTxs.length > 0 && !options.assets) {
                // 2. Aggregate impact per asset
                const assetImpact: Record<string, number> = {};

                allTxs.forEach(tx => {
                    const amt = Number(tx.amount);
                    if (tx.asset_id) {
                        if (!assetImpact[tx.asset_id]) assetImpact[tx.asset_id] = 0;
                        if (tx.type === 'INCOME') assetImpact[tx.asset_id] += amt;
                        else if (tx.type === 'EXPENSE') assetImpact[tx.asset_id] -= amt;
                        else if (tx.type === 'TRANSFER') assetImpact[tx.asset_id] -= amt;
                    }
                    if (tx.to_asset_id && tx.type === 'TRANSFER') {
                        if (!assetImpact[tx.to_asset_id]) assetImpact[tx.to_asset_id] = 0;
                        assetImpact[tx.to_asset_id] += amt;
                    }
                });

                // 3. Apply Reversion to Assets
                const { data: currentAssets } = await supabase.from('assets').select('id, balance');
                if (currentAssets) {
                    for (const asset of currentAssets) {
                        const netChange = assetImpact[asset.id] || 0;
                        // Avoid unnecessary writes if net change is 0
                        if (netChange !== 0) {
                            const originalBalance = Number(asset.balance) - netChange;
                            await supabase.from('assets').update({ balance: originalBalance }).eq('id', asset.id);
                        }
                    }
                }
            }

            await supabase.from('transactions').delete().neq('id', dummyId);
        }

        if (options.recurring) {
            // Fix: Table name is 'recurring_transactions', not 'recurring'
            await supabase.from('recurring_transactions').delete().neq('id', dummyId);
        }

        if (options.goals) {
            // Fix: Table name is 'savings_goals', not 'goals'
            await supabase.from('savings_goals').delete().neq('id', dummyId);
        }

        if (options.budgets) {
            await supabase.from('budgets').delete().neq('id', dummyId);
        }

        if (options.assets) {
            // Deleting assets might cascade to transactions if foreign keys exist, 
            // but we usually handle transactions separately above.
            await supabase.from('assets').delete().neq('id', dummyId);
        }

        if (options.categories) {
            // Only delete Custom Categories? Or all Categories?
            // Usually we only want to wipe user-defined ones or all 'categories' table data for this user.
            // Assuming 'categories' table contains user categories.
            // Note: DB constraints might prevent this if transactions exist and are not deleted above.
            await supabase.from('categories').delete().neq('id', dummyId);
        }

        console.log("Data reset completed with options:", options);
    }

};

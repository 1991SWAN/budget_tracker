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
        const { data, error } = await supabase.from('assets').select('*');
        if (error) {
            console.error('Error fetching assets:', error);
            return [];
        }
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
        const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
        if (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
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
    resetAllData: async () => {
        // Order matters due to Foreign Keys
        await supabase.from('tags').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('recurring').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('goals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('assets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('custom_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('budgets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        console.log("All data reset successfully.");
    }

};

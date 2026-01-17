import { createClient } from '@supabase/supabase-js';
import { Asset, Transaction, RecurringTransaction, SavingsGoal, AssetType, Category, BillType, CategoryItem, Budget, Tag, TransactionType } from '../types';

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
            initialBalance: Number(row.initial_balance) || 0,
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
            initial_balance: asset.initialBalance,
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

        // V3.1 Pagination Logic:
        // Supabase/PostgREST typically has a hard limit of 1000 rows per request.
        // We use .range() to fetch in batches until all data is retrieved.
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

            // Safety limit to prevent runaway loops (max 10,000 records)
            if (from >= 10000) {
                console.warn('[Supabase] Pagination reached safety limit (10k).');
                break;
            }
        }

        console.log(`[Supabase] getTransactions done. Loaded ${allData.length} records.`);

        // Client-Side Join Optimization:
        // Create a Map of ID -> AssetID for quick lookup
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
            // Client-Side lookup using the Map
            linkedTransactionSourceAssetId: row.linked_transaction_id ? txAssetMap.get(row.linked_transaction_id) : undefined,
            hashKey: row.hash_key,

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
            is_interest_free: tx.installment?.isInterestFree ?? null,
            hash_key: tx.hashKey || null
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
            is_interest_free: tx.installment?.isInterestFree ?? null,

            // Hash Key for Duplicate Detection
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

        const { error } = await supabase
            .from('transactions')
            .delete()
            .in('id', ids);

        if (error) {
            console.error('Error deleting transactions:', error);
            throw error;
        }
    },

    deleteTransactionsByAsset: async (assetId: string) => {
        if (!assetId) return;

        // Delete all transactions where asset_id OR to_asset_id matches
        // Note: OR syntax in Supabase is .or(`asset_id.eq.${assetId},to_asset_id.eq.${assetId}`)
        // But for safety and specific logic ("Clear History of THIS asset"), usually we want to clear everything touching it.

        // 1. Delete all transactions where asset_id OR to_asset_id matches
        const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .or(`asset_id.eq.${assetId},to_asset_id.eq.${assetId}`);

        if (deleteError) {
            console.error(`Error deleting transactions for asset ${assetId}:`, deleteError);
            throw deleteError;
        }

        // 2. Verify: Ensure DB is actually empty for this asset
        const { count, error: countError } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .or(`asset_id.eq.${assetId},to_asset_id.eq.${assetId}`);

        if (countError) {
            console.error("Verification failed during clear history:", countError);
            return;
        }

        // 3. Act: Only reset balance if verified empty
        if (count === 0) {
            console.log(`[Verified] Asset ${assetId} history cleared. Resetting balance to 0.`);
            const { error: updateError } = await supabase
                .from('assets')
                .update({ balance: 0 })
                .eq('id', assetId);

            if (updateError) {
                console.error("Failed to reset asset balance:", updateError);
            }
        } else {
            console.warn(`[Safety] Transactions not fully deleted (Count: ${count}). Balance reset skipped.`);
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
            // SMART RESET (V3.1):
            // Since we now have an explicit initial_balance, we don't need to back-calculate everything.
            // A "Reset" simply wipes transactions and reverts the current balance to the starting point.

            if (!options.assets) {
                // Fetch current assets to know their initial balances
                const { data: currentAssets } = await supabase.from('assets').select('*');
                if (currentAssets) {
                    for (const row of currentAssets) {
                        const initialBalance = Number(row.initial_balance) || 0;
                        console.log(`[SmartReset] Reverting Asset ${row.id} to initial balance: ${initialBalance}`);

                        await supabase
                            .from('assets')
                            .update({ balance: initialBalance })
                            .eq('id', row.id);
                    }
                }
            }

            // Delete all transactions
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
    },

    async linkTransactionsV3(
        sourceUpdate: Partial<Transaction>,
        targetUpdate: Partial<Transaction>
    ) {
        // Enforce safe updates
        if (!sourceUpdate.id || !targetUpdate.id) throw new Error("IDs required for linking.");

        console.log("[SupabaseService] Executing V3 Link...", sourceUpdate, targetUpdate);

        // 1. Update Source (Withdrawal Side)
        const { error: err1 } = await supabase
            .from('transactions')
            .update({
                type: TransactionType.TRANSFER,
                linked_transaction_id: sourceUpdate.linkedTransactionId,
                to_asset_id: sourceUpdate.toAssetId,
                amount: sourceUpdate.amount
            })
            .eq('id', sourceUpdate.id);

        if (err1) throw err1;

        // 2. Update Target (Deposit Side)
        const { error: err2 } = await supabase
            .from('transactions')
            .update({
                type: TransactionType.TRANSFER,
                linked_transaction_id: targetUpdate.linkedTransactionId,
                to_asset_id: null, // Explicitly null for Destination
                amount: targetUpdate.amount
            })
            .eq('id', targetUpdate.id);

        if (err2) {
            throw err2;
        }
    },

    /**
     * Creates a counterpart transaction for a Single-Sided Payment (handleConvert).
     * 1. Creates a new INCOMING transaction for the target asset.
     * 2. Updates the original OUTGOING transaction to link to it.
     * 3. Updates the target asset's balance (Reduces Debt).
     */
    async createTransferPair(
        sourceTx: Transaction,
        targetAssetId: string,
        categoryId: string
    ) {
        if (!sourceTx.id || !targetAssetId) throw new Error("Source Transaction and Target Asset ID required.");

        const targetTxId = crypto.randomUUID();
        console.log("[SupabaseService] Creating Transfer Pair for Payment...", sourceTx.id, "->", targetTxId);

        // 1. Create Target Transaction (Incoming / Deposit)
        // This represents the "Payment Received" on the Credit Card side.
        const targetTx: Partial<Transaction> = {
            id: targetTxId,
            date: sourceTx.date,
            timestamp: sourceTx.timestamp,
            amount: sourceTx.amount, // Same amount
            type: TransactionType.TRANSFER,
            assetId: targetAssetId,
            toAssetId: undefined, // Destination has no toAssetId
            linkedTransactionId: sourceTx.id,
            category: categoryId,
            memo: sourceTx.memo // Keep exact memo as requested
        };

        await this.saveTransaction(targetTx as Transaction);

        // 2. Update Source Transaction (Outgoing / Withdrawal)
        // Convert Expense -> Transfer Out
        const { error: srcError } = await supabase
            .from('transactions')
            .update({
                type: TransactionType.TRANSFER,
                to_asset_id: targetAssetId, // Point to Credit Card
                linked_transaction_id: targetTxId,
                category: categoryId // Unified Category
            })
            .eq('id', sourceTx.id);

        if (srcError) throw srcError;

        // 3. Update Target Asset Balance (Reflect the Payment)
        // Since we created a new "Incoming" transaction, the balance must increase (Debt decreases).
        // We must fetch the latest balance to be safe.
        const { data: assetData, error: assetError } = await supabase
            .from('assets')
            .select('*')
            .eq('id', targetAssetId)
            .single();

        if (assetError || !assetData) {
            console.error("Failed to fetch target asset for balance update", assetError);
            throw new Error("Target Asset not found for balance update.");
        }

        const newBalance = Number(assetData.balance) + Number(sourceTx.amount);

        const { error: updateError } = await supabase
            .from('assets')
            .update({ balance: newBalance })
            .eq('id', targetAssetId);

        if (updateError) throw updateError;

        console.log(`[SupabaseService] Payment Balance Updated: ${assetData.balance} -> ${newBalance}`);
    }

};

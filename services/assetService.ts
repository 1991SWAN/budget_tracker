import { supabase } from './dbClient';
import { Asset, AssetOpeningBalance } from '../types';

export const AssetService = {
    getAssets: async (): Promise<Asset[]> => {
        const { data, error } = await supabase.from('assets').select('*');
        if (error) {
            console.error('Error fetching assets:', error);
            return [];
        }

        // Fetch Opening Balances
        const { data: obData } = await supabase.from('asset_opening_balances').select('*');
        const obMap = new Map(obData?.map((ob: any) => [ob.asset_id, Number(ob.amount)]) || []);

        return data.map((row: any) => ({
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
        })) as Asset[];
    },

    saveAsset: async (asset: Asset) => {
        const { data: { user } } = await supabase.auth.getUser();
        const row = {
            id: asset.id,
            user_id: user?.id,
            name: asset.name,
            type: asset.type,
            balance: asset.balance,
            currency: asset.currency,
            description: asset.description,
            interest_rate: asset.interestRate,
            limit: asset.limit,
            credit_details: asset.creditDetails,
            loan_details: asset.loanDetails,
            bank_details: asset.bankDetails,
            investment_details: asset.investmentDetails,
            institution: asset.institution,
            account_number: asset.accountNumber,
            exclude_from_total: asset.excludeFromTotal,
            theme: asset.theme,
        };

        const { error } = await supabase.from('assets').upsert(row);
        if (error) console.error('Error saving asset:', error);
    },

    deleteAsset: async (id: string) => {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) console.error('Error deleting asset:', error);
    },

    getOpeningBalances: async (): Promise<AssetOpeningBalance[]> => {
        const { data, error } = await supabase.from('asset_opening_balances').select('*');
        if (error) {
            console.error('Error fetching opening balances:', error);
            return [];
        }
        return data as AssetOpeningBalance[];
    },

    saveOpeningBalance: async (ob: Partial<AssetOpeningBalance>) => {
        const { data: { user } } = await supabase.auth.getUser();
        const row = {
            ...ob,
            user_id: user?.id,
            amount: Number(ob.amount),
        };
        const { error } = await supabase.from('asset_opening_balances').upsert(row, { onConflict: 'asset_id' });
        if (error) console.error('Error saving opening balance:', error);
    },

    deleteOpeningBalance: async (assetId: string) => {
        const { error } = await supabase.from('asset_opening_balances').delete().eq('asset_id', assetId);
        if (error) console.error('Error deleting opening balance:', error);
    },
};

import { supabase } from './dbClient';
import { RecurringTransaction } from '../types';

export const RecurringService = {
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
};

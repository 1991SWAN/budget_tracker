import { supabase } from './dbClient';
import { SavingsGoal } from '../types';

export const GoalService = {
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
};

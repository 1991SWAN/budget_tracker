import { supabase } from './dbClient';

export const ProfileService = {
    getProfile: async () => {
        try {
            const { data, error } = await supabase.from('profiles').select('*').single();
            if (error) {
                if (error.code === 'PGRST116') return null;
                console.error('Error fetching profile:', error);
                return null;
            }
            return {
                ...data,
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
};

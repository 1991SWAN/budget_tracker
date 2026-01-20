import { supabase } from './dbClient';
import { Tag } from '../types';

export const TagService = {
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
            const { data: existing } = await supabase
                .from('tags')
                .select('id, usage_count')
                .eq('name', cleanName)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('tags')
                    .update({ usage_count: existing.usage_count + 1 })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('tags')
                    .insert({ name: cleanName, usage_count: 1 });
            }
        } catch (err) {
            console.error('Error upserting tag:', err);
        }
    },
};

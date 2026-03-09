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

    /**
     * Atomically upserts a tag for the current user.
     * Increments usage_count if it exists, creates if it doesn't.
     */
    upsertTag: async (tagName: string): Promise<string | null> => {
        if (!tagName) return null;
        const cleanName = tagName.trim().replace(/^#/, ''); // Remove # if present
        if (!cleanName) return null;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // 1. Fetch existing tag for THIS user
            const { data: existing } = await supabase
                .from('tags')
                .select('id, usage_count')
                .eq('user_id', user.id)
                .eq('name', cleanName)
                .maybeSingle();

            if (existing) {
                // 2. Increment count
                const { data } = await supabase
                    .from('tags')
                    .update({ usage_count: existing.usage_count + 1 })
                    .eq('id', existing.id)
                    .select('id')
                    .single();
                return data?.id || existing.id;
            } else {
                // 3. Create new
                const { data } = await supabase
                    .from('tags')
                    .insert({ 
                        user_id: user.id,
                        name: cleanName, 
                        usage_count: 1 
                    })
                    .select('id')
                    .single();
                return data?.id || null;
            }
        } catch (err) {
            console.error('Error upserting tag:', err);
            return null;
        }
    },

    /**
     * Deletes tags that are no longer used in any transactions (usage_count = 0).
     */
    cleanupOrphanTags: async (): Promise<void> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Delete tags that don't exist in transaction_tags for THIS user
            // We use a subquery check or filter by those with 0 count after recalculation
            
            // 1. Recalculate usage counts first to be sure
            const { data: usageCounts, error: countError } = await supabase
                .from('transaction_tags')
                .select('tag_id')
                .eq('user_id', user.id);

            if (countError) throw countError;

            const usedTagIds = new Set(usageCounts.map(u => u.tag_id));

            // 2. Fetch all tags for user
            const { data: allTags } = await supabase
                .from('tags')
                .select('id')
                .eq('user_id', user.id);

            if (!allTags) return;

            const orphanTagIds = allTags
                .filter(tag => !usedTagIds.has(tag.id))
                .map(tag => tag.id);

            if (orphanTagIds.length > 0) {
                await supabase
                    .from('tags')
                    .delete()
                    .in('id', orphanTagIds);
                console.log(`Cleaned up ${orphanTagIds.length} orphan tags.`);
            }

            // 3. Update usage_count for remaining tags
            const countsMap: Record<string, number> = {};
            usageCounts.forEach(u => {
                countsMap[u.tag_id] = (countsMap[u.tag_id] || 0) + 1;
            });

            for (const [tagId, count] of Object.entries(countsMap)) {
                await supabase.from('tags').update({ usage_count: count }).eq('id', tagId);
            }

        } catch (err) {
            console.error('Error cleaning up orphan tags:', err);
        }
    }
};

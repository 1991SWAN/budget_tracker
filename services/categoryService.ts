import { supabase } from './dbClient';
import { CategoryItem } from '../types';

export const CategoryService = {
    getCategories: async (): Promise<CategoryItem[]> => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true });

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

        if (!row.user_id) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                row.user_id = session.user.id;
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.id) {
                    row.user_id = user.id;
                } else {
                    row.user_id = '00000000-0000-0000-0000-000000000000';
                }
            }
        }

        if (!row.id) delete row.id;

        const { error } = await supabase.from('categories').upsert(row);
        if (error) console.error('Error saving category:', error);
    },

    deleteCategory: async (id: string) => {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) console.error('Error deleting category:', error);
    },
};

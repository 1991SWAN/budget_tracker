import { useCallback, useEffect, useState } from 'react';
import { Asset, CategoryItem, Tag as TagType } from '../types';
import { TagService } from '../services/tagService';

export const useSmartInputAI = (assets: Asset[], categories: CategoryItem[]) => {
    const [availableTags, setAvailableTags] = useState<TagType[]>([]);

    useEffect(() => {
        let mounted = true;

        const loadTags = async () => {
            const tags = await TagService.getTags();
            if (mounted) {
                setAvailableTags(tags);
            }
        };

        void loadTags();
        return () => {
            mounted = false;
        };
    }, []);

    const analyzeReceipt = useCallback(async (file: File) => {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
        });

        reader.readAsDataURL(file);
        const base64 = await base64Promise;
        const { GeminiService } = await import('../services/geminiService');
        return await GeminiService.parseReceipt(base64, categories, assets);
    }, [assets, categories]);

    return {
        availableTags,
        analyzeReceipt,
    };
};

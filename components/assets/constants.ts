import { AssetType } from '../../types';

export const ASSET_THEMES: Record<AssetType, { bg: string, text: string, icon: string, border: string }> = {
    [AssetType.CASH]: {
        bg: 'bg-teal-500', // Cash -> Teal (Fresh/Liquid)
        text: 'text-white',
        icon: '💵',
        border: 'border-teal-400'
    },
    [AssetType.CHECKING]: {
        bg: 'bg-blue-600', // Checking -> Royal Blue (Trust/Active)
        text: 'text-white',
        icon: '💳',
        border: 'border-blue-500'
    },
    [AssetType.SAVINGS]: {
        bg: 'bg-violet-600', // Savings -> Violet (Wealth/Premium)
        text: 'text-white',
        icon: '🐷',
        border: 'border-violet-500'
    },
    [AssetType.CREDIT_CARD]: {
        bg: 'bg-rose-500', // Credit -> Rose (Warning/Debt)
        text: 'text-white',
        icon: '💳',
        border: 'border-rose-400'
    },
    [AssetType.INVESTMENT]: {
        bg: 'bg-indigo-700', // Investment -> Indigo (Depth/Long-term)
        text: 'text-white',
        icon: '📈',
        border: 'border-indigo-600'
    },
    [AssetType.LOAN]: {
        bg: 'bg-slate-500', // Loan -> Slate (Neutral/Burden)
        text: 'text-white',
        icon: '🏦',
        border: 'border-slate-400'
    },
};

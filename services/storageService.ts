import { Transaction, Asset, AssetType, Category, RecurringTransaction, SavingsGoal, BillType } from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'smartpenny_transactions',
  ASSETS: 'smartpenny_assets',
  RECURRING: 'smartpenny_recurring',
  GOALS: 'smartpenny_goals',
  BUDGET: 'smartpenny_budget',
};

const DEFAULT_ASSETS: Asset[] = [
  {
    id: '1',
    name: 'Wallet Cash',
    type: AssetType.CASH,
    balance: 150000,
    currency: 'KRW',
    description: 'Petty cash on hand'
  },
  {
    id: '2',
    name: 'Salary Account',
    type: AssetType.CHECKING,
    balance: 2500000,
    currency: 'KRW',
    description: 'KB Bank •••• 1234',
    interestRate: 0.1
  },
  {
    id: '3',
    name: 'Main Credit Card',
    type: AssetType.CREDIT_CARD,
    balance: -450000,
    currency: 'KRW',
    creditDetails: { limit: 3000000, apr: 18, billingCycle: { usageStartDay: 1, usageEndDay: 31, paymentDay: 25 } },
    description: 'Hyundai Card'
  },
  {
    id: '4',
    name: 'Stock Portfolio',
    type: AssetType.INVESTMENT,
    balance: 5000000,
    currency: 'KRW',
    interestRate: 8.5,
    description: 'Toss Securities'
  },
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    date: new Date().toISOString().split('T')[0],
    amount: 12000,
    type: 'EXPENSE' as any,
    category: Category.FOOD,
    memo: 'Lunch at Cafeteria',

    assetId: '2'
  },
  {
    id: 't2',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
    amount: 4500,
    type: 'EXPENSE' as any,
    category: Category.TRANSPORT,
    memo: 'Subway',
    // emoji: '🚇',
    assetId: '1'
  },
  {
    id: 't3',
    date: new Date(Date.now() - 172800000).toISOString().split('T')[0], // 2 days ago
    amount: 32000,
    type: 'EXPENSE' as any,
    category: Category.SHOPPING,
    memo: 'Olive Young',

    assetId: '3'
  },
];

const DEFAULT_RECURRING: RecurringTransaction[] = [
  {
    id: 'r1',
    name: 'Netflix',
    amount: 13500,
    dayOfMonth: 25,
    category: Category.ENTERTAINMENT,
    billType: BillType.SUBSCRIPTION
  },
  {
    id: 'r2',
    name: 'Monthly Rent',
    amount: 500000,
    dayOfMonth: 28,
    category: Category.HOUSING,
    billType: BillType.LIVING
  },
  {
    id: 'r3',
    name: 'Car Insurance',
    amount: 65000,
    dayOfMonth: 15,
    category: Category.UTILITIES,
    billType: BillType.INSURANCE
  },
];

const DEFAULT_GOALS: SavingsGoal[] = [
  { id: 'g1', name: 'Europe Trip', targetAmount: 3000000, currentAmount: 1200000, emoji: '✈️', deadline: '2024-12-31' },
  { id: 'g2', name: 'New Laptop', targetAmount: 2000000, currentAmount: 400000, emoji: '💻' },
];

export const StorageService = {
  getTransactions: (): Transaction[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : DEFAULT_TRANSACTIONS;
    } catch (e) {
      console.error("Failed to load transactions", e);
      return [];
    }
  },

  saveTransactions: (transactions: Transaction[]) => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  getAssets: (): Asset[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ASSETS);
      return data ? JSON.parse(data) : DEFAULT_ASSETS;
    } catch (e) {
      console.error("Failed to load assets", e);
      return [];
    }
  },

  saveAssets: (assets: Asset[]) => {
    localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(assets));
  },

  getRecurringExpenses: (): RecurringTransaction[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECURRING);
      return data ? JSON.parse(data) : DEFAULT_RECURRING;
    } catch (e) {
      return DEFAULT_RECURRING;
    }
  },

  saveRecurringExpenses: (recurring: RecurringTransaction[]) => {
    localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(recurring));
  },

  getSavingsGoals: (): SavingsGoal[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GOALS);
      return data ? JSON.parse(data) : DEFAULT_GOALS;
    } catch (e) {
      return DEFAULT_GOALS;
    }
  },

  saveSavingsGoals: (goals: SavingsGoal[]) => {
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
  },

  getBudget: (): number => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BUDGET);
      return data ? Number(data) : 2500000;
    } catch (e) {
      return 2500000;
    }
  },

  saveBudget: (amount: number) => {
    localStorage.setItem(STORAGE_KEYS.BUDGET, amount.toString());
  }
};

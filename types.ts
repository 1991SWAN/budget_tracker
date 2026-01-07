
export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER'
}

export enum AssetType {
  CASH = 'CASH',
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD',
  INVESTMENT = 'INVESTMENT'
}

export enum Category {
  FOOD = 'Food & Dining',
  TRANSPORT = 'Transportation',
  SHOPPING = 'Shopping',
  HOUSING = 'Housing',
  UTILITIES = 'Utilities',
  HEALTH = 'Health & Fitness',
  ENTERTAINMENT = 'Entertainment',
  SALARY = 'Salary',
  INVESTMENT = 'Investment',
  TRANSFER = 'Transfer',
  OTHER = 'Other'
}

export enum BillType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  INSURANCE = 'INSURANCE',
  INSTALLMENT = 'INSTALLMENT',
  LIVING = 'LIVING',
  CARD_PAYMENT = 'CARD_PAYMENT' // Added for credit card settlement
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  balance: number; 
  currency: string;
  color?: string;
  description?: string;
  
  // Credit Card Specifics
  limit?: number;
  billingDay?: number;
  paymentDay?: number;
  apr?: number; // Annual Percentage Rate for interest-bearing installments
  
  // Savings/Investment Specifics
  interestRate?: number;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD string for display grouping
  timestamp?: number; // Epoch time for precise matching
  amount: number;
  type: TransactionType;
  category: Category | string;
  memo: string;
  emoji?: string; 
  merchant?: string; 
  assetId: string; 
  toAssetId?: string; 
  
  // Data Integrity & Linking
  hashKey?: string; // Unique identifier (Asset + Time + Amount + Memo)
  linkedTransactionId?: string; // For matched transfers
  originalText?: string; // Raw CSV description for matching logic

  installment?: {
    totalMonths: number;
    isInterestFree: boolean;
    monthlyAmount?: number;
    interestRate?: number; // Specific interest rate for this purchase
  };
}

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  category: Category;
  billType: BillType;

  installmentDetails?: {
    startDate: string;
    totalAmount: number;
    totalMonths: number;
    isInterestFree: boolean;
    feePerMonth?: number; // Calculated interest fee
  };
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  emoji?: string;
  deadline?: string;
}

export type View = 'dashboard' | 'transactions' | 'assets' | 'add' | 'analysis';

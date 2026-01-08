
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
  INVESTMENT = 'INVESTMENT',
  LOAN = 'LOAN'
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
  CARD_PAYMENT = 'CARD_PAYMENT'
}

export interface CreditCardDetails {
  limit: number;
  apr: number;
  // Flexible Billing Cycle
  billingCycle: {
    usageStartDay: number; // e.g. 1st
    usageEndDay: number;   // e.g. End of month (calculated)
    paymentDay: number;    // e.g. 14th of next month
  };
}

export interface LoanDetails {
  principal: number; // Original amount
  interestRate: number;
  startDate: string;
  termMonths: number;
  monthlyPayment?: number; // Fixed monthly payment (principal + interest)
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  balance: number;
  currency: string;
  color?: string;
  description?: string;

  // Type Specifics
  creditDetails?: CreditCardDetails;
  loanDetails?: LoanDetails;

  // Legacy support for migration (optional)
  interestRate?: number;
  limit?: number; // Deprecated, move to creditDetails
}

export interface Transaction {
  id: string;
  date: string;
  timestamp?: number;
  amount: number;
  type: TransactionType;
  category: Category | string;
  memo: string;
  emoji?: string;
  merchant?: string;
  assetId: string;
  toAssetId?: string;

  hashKey?: string;
  linkedTransactionId?: string;
  originalText?: string;

  installment?: {
    totalMonths: number;
    currentMonth: number; // 1-based index (e.g. 3 of 12)
    isInterestFree: boolean;
    remainingBalance: number; // helper for display
  };
}

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  category: Category;
  billType: BillType;
  groupName?: string; // For custom grouping (e.g. "Housing", "Subscriptions")

  installmentDetails?: {
    startDate: string;
    totalAmount: number;
    totalMonths: number;
    isInterestFree: boolean;
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

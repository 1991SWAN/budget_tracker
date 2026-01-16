
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

export interface CategoryItem {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  is_default: boolean;
  sort_order: number;
  color?: string;
  created_at?: string;
}

/**
 * @deprecated Use CategoryItem interface instead. Keeping for legacy data migration.
 */
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
  paymentDate?: number;     // e.g. 25 (Day of month)
}

export interface LoanDetails {
  principal: number; // Original amount
  interestRate: number;
  startDate: string;
  termMonths: number;
  monthlyPayment?: number; // Fixed monthly payment (principal + interest)
  endDate?: string;        // Estimated Payoff Date
  paymentType?: 'AMORTIZATION' | 'INTEREST_ONLY'; // Repayment Method
}

export interface BankDetails {
  interestRate?: number;    // Yearly Interest Rate (%)
  maturityDate?: string;    // Maturity Date (for Savings/CDs)
  isMainAccount?: boolean;  // Is this the primary spending account?
}

export interface InvestmentDetails {
  // Stocks / Crypto
  symbol?: string;          // e.g. AAPL, BTC
  quantity?: number;        // Number of shares/units
  averagePrice?: number;    // Cost basis per unit

  // Real Estate / Vehicle
  address?: string;         // Address or Model Name
  purchasePrice?: number;   // Original Purchase Price
  purchaseDate?: string;    // Date of Purchase

  // Common
  currentPrice?: number;    // Current Unit Price (Stocks) or Market Value (Real Estate)
  valuationDate?: string;   // Last Valuation Date
  roi?: number;             // Return on Investment (Calculated)
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
  bankDetails?: BankDetails;      // NEW
  investmentDetails?: InvestmentDetails; // NEW

  // Common Extended Fields
  institution?: string;      // e.g. Chase, Bank of America
  accountNumber?: string;    // Last 4 Digits
  excludeFromTotal?: boolean;// Exclude from Net Worth calculation
  theme?: string;            // Visual Theme (Gradient ID)

  // Legacy support for migration (optional)
  interestRate?: number;
  limit?: number; // Deprecated, move to creditDetails
}



// Dictionary for Tag Autocomplete
export interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

export interface Transaction {
  id: string;
  date: string;
  timestamp?: number;
  amount: number;
  type: TransactionType;
  category: string; // Stores Category ID (UUID) or Name (Legacy)
  memo: string;
  assetId: string;
  toAssetId?: string;

  hashKey?: string;
  linkedTransactionId?: string;
  linkedTransactionSourceAssetId?: string; // New: For rendering "From Asset" on Target Side
  originalText?: string;
  merchant?: string; // Parsed Merchant Name

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

export type View = 'dashboard' | 'transactions' | 'assets' | 'add' | 'analysis' | 'settings' | 'settings-categories';

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  year?: number;
  month?: number;
  created_at?: string;
}

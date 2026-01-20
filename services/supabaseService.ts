import { supabase } from './dbClient';
import { AssetService } from './assetService';
import { TransactionService } from './transactionService';
import { CategoryService } from './categoryService';
import { GoalService } from './goalService';
import { RecurringService } from './recurringService';
import { BudgetService } from './budgetService';
import { ProfileService } from './profileService';
import { TagService } from './tagService';
import { DataService } from './dataService';

export { supabase };

export const SupabaseService = {
    ...AssetService,
    ...TransactionService,
    ...CategoryService,
    ...GoalService,
    ...RecurringService,
    ...BudgetService,
    ...ProfileService,
    ...TagService,
    ...DataService,
};

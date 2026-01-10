import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Transaction, Asset, RecurringTransaction, SavingsGoal } from '../types';
import OverviewTab from './dashboard/OverviewTab';
import TrendsTab from './dashboard/TrendsTab';
import PlanningTab from './dashboard/PlanningTab';

interface DashboardProps {
  transactions: Transaction[];
  assets: Asset[];
  recurring: RecurringTransaction[];
  goals: SavingsGoal[];
  onRecurringChange: (action: 'add' | 'update' | 'delete' | 'pay', item: any) => void;
  onGoalChange: (action: 'add' | 'update' | 'delete' | 'contribute', item: any) => void;
  onAddTransaction: (transaction: Transaction) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  monthlyBudget: number;
  onBudgetChange: (amount: number) => void;
  onNavigateToTransactions: (dateRange?: { start: string, end: string } | null) => void;
  onAddBillToGroup?: (group: string) => void; // Legacy usage from App
}

type TabUser = 'overview' | 'trends' | 'planning';

const Dashboard: React.FC<DashboardProps> = ({
  transactions, assets, recurring, goals,
  onRecurringChange, onGoalChange, onEditTransaction, onDeleteTransaction,
  monthlyBudget, onBudgetChange, onNavigateToTransactions
}) => {
  const [activeTab, setActiveTab] = useState<TabUser>('overview');
  const [activityFilter, setActivityFilter] = useState<'today' | 'week' | 'month'>('month');

  // Budget Modal State specific to Dashboard wrapper (since Overview triggers it)
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const openBudgetModal = () => {
    setBudgetInput(monthlyBudget.toString());
    setIsBudgetModalOpen(true);
  };

  const saveBudget = () => {
    onBudgetChange(Number(budgetInput));
    setIsBudgetModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
          <p className="text-muted">Welcome back! Here's your financial overview.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-full self-start sm:self-auto">
          {(['overview', 'trends', 'planning'] as TabUser[]).map((tab) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              variant="ghost"
              className={`px-4 py-2 rounded-full text-sm font-bold capitalize transition-all ${activeTab === tab
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted hover:text-text hover:bg-transparent'
                }`}
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs Content */}
      <div className="min-h-[500px]">
        {activeTab === 'overview' && (
          <OverviewTab
            transactions={transactions}
            assets={assets}
            recurring={recurring}
            monthlyBudget={monthlyBudget}
            onOpenBudgetModal={openBudgetModal}
            onNavigateToTransactions={() => onNavigateToTransactions()}
            onNavigateToAssets={() => { /* No-op or implementation needed if switching views */ }}
            onEditTransaction={onEditTransaction}
            onDeleteTransaction={(tx) => onDeleteTransaction(tx.id)}
            activityFilter={activityFilter}
            onFilterChange={setActivityFilter}
          />
        )}

        {activeTab === 'trends' && (
          <TrendsTab transactions={transactions} />
        )}

        {activeTab === 'planning' && (
          <PlanningTab
            recurring={recurring}
            goals={goals}
            assets={assets}
            onRecurringChange={onRecurringChange}
            onGoalChange={onGoalChange}
          />
        )}
      </div>

      {/* Budget Modal (Legacy local implementation - Phase 2 will abstract this) */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsBudgetModalOpen(false)}>
          <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-primary mb-4">Set Monthly Budget</h3>
            <input
              type="number"
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl mb-4 text-lg font-bold outline-primary"
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={() => setIsBudgetModalOpen(false)} variant="ghost" className="flex-1">Cancel</Button>
              <Button onClick={saveBudget} className="flex-1">Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

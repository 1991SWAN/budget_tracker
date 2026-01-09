import React, { useState } from 'react';
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
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Welcome back! Here's your financial overview.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          {(['overview', 'trends', 'planning'] as TabUser[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              {tab}
            </button>
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

      {/* Local Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsBudgetModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Set Monthly Budget</h3>
            <p className="text-sm text-slate-500 mb-4">Set your total monthly budget or expected income.</p>
            <input
              type="number"
              placeholder="e.g. 3,000,000"
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              className="w-full p-4 border border-blue-200 bg-blue-50 rounded-xl font-bold text-2xl text-blue-900 focus:outline-none mb-6"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveBudget()}
            />
            <div className="flex gap-2">
              <button onClick={() => setIsBudgetModalOpen(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={saveBudget} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

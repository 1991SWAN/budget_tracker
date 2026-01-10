import React, { useMemo } from 'react';
import { RecurringTransaction, SavingsGoal, Asset } from '../../types';
import BillManager from '../bills/BillManager';
import GoalManager from '../goals/GoalManager';

interface PlanningTabProps {
    recurring: RecurringTransaction[];
    goals: SavingsGoal[];
    assets: Asset[];
    onRecurringChange: (action: 'add' | 'update' | 'delete' | 'pay', item: any) => void;
    onGoalChange: (action: 'add' | 'update' | 'delete' | 'contribute', item: any) => void;
}

const PlanningTab: React.FC<PlanningTabProps> = ({ recurring, goals, assets, onRecurringChange, onGoalChange }) => {
    const today = new Date();

    // Generate days for the current month for Calendar Strip
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* 1. Visual Calendar Strip */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><span>🗓️</span> Monthly Schedule</h3>
                    <div className="text-sm text-slate-400 font-medium">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-4 pt-2 px-2 scrollbar-hide snap-x">
                    {days.map(day => {
                        const isToday = day === today.getDate();
                        // Find bills due on this day
                        const billsOnDay = recurring.filter(r => r.dayOfMonth === day);
                        const hasBill = billsOnDay.length > 0;

                        return (
                            <div key={day} className={`flex-shrink-0 w-14 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 border snap-center transition-all ${isToday ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-200 scale-105' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                <span className={`text-xs font-medium uppercase ${isToday ? 'text-slate-300' : ''}`}>{new Date(today.getFullYear(), today.getMonth(), day).toLocaleString('default', { weekday: 'short' })}</span>
                                <span className={`text-xl font-bold ${isToday ? 'text-white' : 'text-slate-800'}`}>{day}</span>
                                <div className="h-1.5 flex gap-0.5">
                                    {hasBill && <div className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-rose-400' : 'bg-rose-500'}`}></div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 2. Managers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BillManager
                    recurring={recurring}
                    assets={assets}
                    onRecurringChange={onRecurringChange}
                />
                <GoalManager
                    goals={goals}
                    assets={assets}
                    onGoalChange={onGoalChange}
                />
            </div>
        </div>
    );
};

export default PlanningTab;

import React, { useMemo, useState } from 'react';
import { RecurringTransaction, Transaction } from '../../types';
import { SubscriptionCalculator } from '../../utils/SubscriptionCalculator';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SubscriptionViewProps {
    recurring: RecurringTransaction[];
    transactions: Transaction[]; // For future auto-match, currently unused but good for API stability
    onEdit: (bill: RecurringTransaction) => void;
}

const SubscriptionView: React.FC<SubscriptionViewProps> = ({ recurring, transactions, onEdit }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = useMemo(() => {
        return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    }, [currentDate]);

    const monthBills = useMemo(() => {
        // Determine status for each bill for this month
        return recurring.map(bill => ({
            ...bill,
            status: SubscriptionCalculator.getBillStatus(bill, currentDate, transactions)
        }));
    }, [recurring, currentDate, transactions]);

    const totalMonthly = useMemo(() => {
        return SubscriptionCalculator.calculateTotalMonthlyFixed(recurring);
    }, [recurring]);

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sun

    const renderCalendarDays = () => {
        const calendarDays = [];

        // Empty slots for previous month
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarDays.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100/50"></div>);
        }

        // Days of current month
        for (let day = 1; day <= daysInMonth; day++) {
            const billsToday = monthBills.filter(b => b.dayOfMonth === day);
            const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

            calendarDays.push(
                <div key={day} className={`h-24 p-1 border border-slate-100 flex flex-col ${isToday ? 'bg-indigo-50/30' : 'bg-white'}`}>
                    <div className={`text-xs font-bold mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{day}</div>
                    <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                        {billsToday.map(bill => (
                            <div
                                key={bill.id}
                                className={`text-[10px] truncate px-1.5 py-0.5 rounded cursor-pointer transition-colors ${bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                                    bill.status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' :
                                        'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                onClick={() => onEdit(bill)}
                            >
                                {bill.name}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return calendarDays;
    };

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-bold w-48 text-center tabular-nums">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex gap-4">
                    <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Fixed Cost</p>
                        <p className="text-xl font-black text-slate-800">{totalMonthly.toLocaleString()} <span className="text-sm font-normal text-slate-400">KRW</span></p>
                    </div>
                    <div className="bg-indigo-600 px-5 py-3 rounded-2xl shadow-lg shadow-indigo-200 text-right text-white">
                        <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Estimated</p>
                        <p className="text-xl font-black">{totalMonthly.toLocaleString()} <span className="text-sm font-normal text-indigo-200">KRW</span></p>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="p-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7">
                    {renderCalendarDays()}
                </div>
            </div>

        </div>
    );
};

export default SubscriptionView;

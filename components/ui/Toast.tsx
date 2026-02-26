import React, { useEffect, useState } from 'react';
import { ToastMessage, ToastType } from '../../contexts/ToastContext';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface ToastProps {
    toast: ToastMessage;
    onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onRemove }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Small delay to ensure the initial render happens before the animation starts
        const timer = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleRemove = () => {
        setVisible(false);
        setTimeout(() => onRemove(toast.id), 300); // Wait for exit animation
    };

    const iconColors = {
        success: 'text-emerald-400',
        error: 'text-rose-400',
        info: 'text-blue-400',
    };

    const icons = {
        success: <CheckCircle size={18} className={iconColors.success} />,
        error: <AlertTriangle size={18} className={iconColors.error} />,
        info: <Info size={18} className={iconColors.info} />,
    };

    return (
        <div className={`
      flex items-center gap-3 px-4 py-3 rounded-full border border-white/10 shadow-2xl backdrop-blur-md bg-gray-900/95 min-w-[280px] max-w-sm mb-3 transition-all duration-300 transform pointer-events-auto
      ${visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}
    `}>
            <div className="shrink-0">{icons[toast.type]}</div>
            <p className="flex-1 text-sm font-medium text-white tracking-wide">{toast.message}</p>
            <button onClick={handleRemove} className="text-gray-400 hover:text-white transition-colors p-1 -mr-1">
                <X size={16} />
            </button>
        </div>
    );
};

export const ToastContainer: React.FC<{ toasts: ToastMessage[], onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center pointer-events-none">
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} onRemove={onRemove} />
            ))}
        </div>
    );
};

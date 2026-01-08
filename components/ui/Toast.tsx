import React, { useEffect, useState } from 'react';
import { ToastMessage, ToastType } from '../../contexts/ToastContext';
import { X } from 'lucide-react';

interface ToastProps {
    toast: ToastMessage;
    onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onRemove }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleRemove = () => {
        setVisible(false);
        setTimeout(() => onRemove(toast.id), 300); // Wait for exit animation
    };

    const bgColors = {
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        error: 'bg-rose-50 border-rose-200 text-rose-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    const icons = {
        success: '✅',
        error: '⚠️',
        info: 'ℹ️',
    };

    return (
        <div className={`
      flex items-center gap-3 p-4 rounded-xl border shadow-lg max-w-sm w-full mb-3 transition-all duration-300 transform
      ${bgColors[toast.type]}
      ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
    `}>
            <span className="text-xl">{icons[toast.type]}</span>
            <p className="flex-1 text-sm font-semibold">{toast.message}</p>
            <button onClick={handleRemove} className="opacity-50 hover:opacity-100 p-1">
                <X size={16} />
            </button>
        </div>
    );
};

export const ToastContainer: React.FC<{ toasts: ToastMessage[], onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col items-end pointer-events-none">
            <div className="pointer-events-auto">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onRemove={onRemove} />
                ))}
            </div>
        </div>
    );
};

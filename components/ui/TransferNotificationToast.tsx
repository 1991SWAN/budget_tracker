import React, { useEffect, useState } from 'react';
import { Button } from './Button';

interface TransferNotificationToastProps {
    count: number;
    onReview: () => void;
}

export const TransferNotificationToast: React.FC<TransferNotificationToastProps> = ({ count, onReview }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (count > 0) {
            // Small delay to allow enter animation
            const timer = setTimeout(() => setIsVisible(true), 500);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [count]);

    if (!isVisible && count === 0) return null;

    return (
        <div className={`fixed bottom-24 md:bottom-10 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="bg-slate-900/90 backdrop-blur-md text-white pl-5 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-4 hover:scale-105 transition-transform border border-white/10">
                <div className="flex items-center gap-3">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="text-sm font-medium">
                        <span className="font-bold text-blue-300">{count}</span> transfer suggestions found
                    </span>
                </div>
                <Button
                    onClick={onReview}
                    size="sm"
                    className="bg-white/10 hover:bg-white/20 text-white border-0 rounded-full px-4 h-8 text-xs font-bold transition-colors"
                >
                    Review
                </Button>
            </div>
        </div>
    );
};

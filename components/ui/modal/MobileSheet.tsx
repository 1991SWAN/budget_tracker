import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface MobileSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer
}) => {
    // Swipe Logic
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startY = React.useRef(0);

    const onTouchStart = (e: React.TouchEvent) => {
        startY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;
        if (diff > 0) { // Only drag down
            setDragY(diff);
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        if (dragY > 100) {
            onClose(); // Close if dragged enough
        } else {
            setDragY(0); // Reset
        }
    };

    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => {
                setVisible(false);
                setDragY(0);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            document.body.style.overflow = 'unset';
        }
    }, [isOpen]);

    if (!isOpen && !visible) return null;

    return createPortal(
        <div className={`fixed inset-0 z-50 flex items-end justify-center sm:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm touch-none"
                onClick={onClose}
            />

            <div
                className={`relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh] transition-transform duration-200 ease-out transform ${isOpen && !isDragging ? 'translate-y-0' : ''}`}
                style={{
                    transform: isDragging ? `translateY(${dragY}px)` : isOpen ? 'translateY(0)' : 'translateY(100%)',
                    marginBottom: 'env(safe-area-inset-bottom)'
                }}
            >
                {/* Handle Bar (Draggable) */}
                <div
                    className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing touch-none"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
                </div>

                {/* Header */}
                {title && (
                    <div className="px-6 py-2 border-b border-slate-50 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                        <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </div>
                )}

                {/* Scrollable Body */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {children}
                </div>

                {/* Footer (Full Width, Stacked Reverse) */}
                {footer && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 pb-4 safe-area-pb shrink-0">
                        <div className="flex flex-col-reverse gap-3 w-full">
                            {footer}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

import React, { useEffect, useState } from 'react';
import { MobileSheet } from './modal/MobileSheet';
import { DesktopDialog } from './modal/DesktopDialog';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [matches, query]);
    return matches;
}

export const Dialog: React.FC<DialogProps> = (props) => {
    const isDesktop = useMediaQuery('(min-width: 640px)');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null; // Avoid hydration mismatch

    if (isDesktop) {
        return <DesktopDialog {...props} />;
    }

    return <MobileSheet {...props} />;
};

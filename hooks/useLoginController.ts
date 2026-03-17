import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseService';
import { useToast } from '../contexts/ToastContext';

export const useLoginController = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
    const { addToast } = useToast();

    useEffect(() => {
        const reason = sessionStorage.getItem('logout_reason');
        if (reason === 'concurrent_login') {
            addToast('Logged out because account was accessed from another device.', 'error');
            sessionStorage.removeItem('logout_reason');
        }
    }, [addToast]);

    const handleAuth = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'LOGIN') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                addToast('Confirmation email sent! Please check your inbox.', 'success');
            }
        } catch (error: any) {
            addToast(error.message || 'Authentication failed', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, email, mode, password]);

    const handleGoogleAuth = useCallback(async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            });
            if (error) throw error;
        } catch (error: any) {
            addToast(error.message || 'Google sign in failed', 'error');
            setLoading(false);
        }
    }, [addToast]);

    const toggleMode = useCallback(() => {
        setMode(previous => previous === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
    }, []);

    return {
        email,
        setEmail,
        password,
        setPassword,
        loading,
        mode,
        handleAuth,
        handleGoogleAuth,
        toggleMode,
    };
};

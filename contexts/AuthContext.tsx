import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseService';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Safe UUID generator for non-secure contexts (mobile dev via IP)
    const generateSessionId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // Local unique ID for this browser tab/session (Persisted to allow refreshes/tabs)
    const [deviceSessionId] = useState(() => {
        const STORAGE_KEY = 'smartpenny_device_id';
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return stored;

        const newId = generateSessionId();
        localStorage.setItem(STORAGE_KEY, newId);
        return newId;
    });

    useEffect(() => {
        let mounted = true;

        // 1. Initial Session Check
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            console.log('[Auth] initAuth: session found?', !!session, 'user=', session?.user?.id);

            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);

                // If logged in, register this device as the active session (Fire and forget)
                if (session?.user) {
                    registerDeviceSession(session.user.id).catch(err => {
                        console.error('[Auth] Background session registration failed:', err);
                    });
                }
            }
        };
        initAuth();

        // 2. Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);

                // If logged in, register this device as the active session (Fire and forget)
                if (session?.user) {
                    registerDeviceSession(session.user.id).catch(err => {
                        console.error('[Auth] Background session registration failed:', err);
                    });
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // 3. Realtime Subscription for Force Logout
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('public:profiles')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                (payload) => {
                    const newSessionId = payload.new.last_session_id;
                    if (newSessionId && newSessionId !== deviceSessionId) {
                        // Another device took over
                        console.warn('Session expired: New login detected on another device.');
                        signOut(true); // true = force logout with message
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                (payload) => {
                    const newSessionId = payload.new.last_session_id;
                    if (newSessionId && newSessionId !== deviceSessionId) {
                        signOut(true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, deviceSessionId]);

    const registerDeviceSession = async (userId: string) => {
        console.log('[Auth] Registering session:', deviceSessionId);
        // Update DB with my session ID
        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            last_session_id: deviceSessionId,
            updated_at: new Date().toISOString()
        });
        if (error) console.error('[Auth] Failed to register session:', error);
        else console.log('[Auth] Session registered successfully');
    };

    const signOut = async (force: boolean = false) => {
        console.log('[Auth] signOut called. Force:', force);
        try {
            // Race Supabase signOut against a 500ms timeout to prevent hanging
            await Promise.race([
                supabase.auth.signOut(),
                new Promise(resolve => setTimeout(resolve, 500))
            ]);
            console.log('[Auth] Supabase signOut attempted');
        } catch (error) {
            console.error("[Auth] Error signing out:", error);
        }

        // Manual cleanup
        console.log('[Auth] Clearing localStorage...');
        localStorage.clear();

        if (force) {
            sessionStorage.setItem('logout_reason', 'concurrent_login');
        }

        console.log('[Auth] Reloading page...');
        window.location.reload();
    };

    const value = {
        user,
        session,
        isLoading,
        signOut: () => signOut(false),
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

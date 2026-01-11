import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { useToast } from '../contexts/ToastContext';

export const LoginView: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
    const { addToast } = useToast();

    const handleAuth = async (e: React.FormEvent) => {
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
                addToast("Confirmation email sent! Please check your inbox.", 'success');
            }
        } catch (error: any) {
            addToast(error.message || 'Authentication failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Smart Penny 🪙</h1>
                    <p className="text-slate-500">
                        {mode === 'LOGIN' ? 'Welcome back!' : 'Create an account'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="hello@example.com"
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        minLength={6}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (mode === 'LOGIN' ? 'Sign In' : 'Create Account')}
                    </button>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-slate-500">Or continue with</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={loading}
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const { error } = await supabase.auth.signInWithOAuth({
                                    provider: 'google',
                                    options: {
                                        redirectTo: window.location.origin
                                    }
                                });
                                if (error) throw error;
                            } catch (error: any) {
                                addToast(error.message, 'error');
                                setLoading(false);
                            }
                        }}
                        className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="text-lg">🇬</span> Google
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                        {mode === 'LOGIN'
                            ? "Don't have an account? Sign Up"
                            : "Already have an account? Sign In"}
                    </button>
                </div>
            </Card>
        </div>
    );
};


import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../App';
import { LogIn, ShieldCheck, Mail, Lock, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await auth?.login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError('Invalid credentials. Please contact site admin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-8 text-white text-center">
                    <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold">Admin Control Room</h1>
                    <p className="text-blue-100 text-sm mt-2">Authorized Access Only</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="admin@school.sch.id"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                            <ForgotPasswordLink email={email} />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <LogIn className="w-5 h-5" />}
                        Enter Control Room
                    </button>

                    <div className="text-center pt-4">
                        <p className="text-sm text-slate-500">
                            Don't have an account?{' '}
                            <Link to="/register" className="text-blue-600 font-bold hover:underline">
                                Sign Up
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Inline Forgot-Password widget — link next to the Password label     */
/* ------------------------------------------------------------------ */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

const ForgotPasswordLink: React.FC<{ email: string }> = ({ email }) => {
    const [open, setOpen] = useState(false);
    const [fpEmail, setFpEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [fpError, setFpError] = useState('');

    const handleOpen = () => {
        setFpEmail(email); // pre-fill if user already typed their email
        setSent(false);
        setFpError('');
        setOpen(true);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setFpError('');
        try {
            await fetch(`${API_BASE}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: fpEmail }),
            });
            setSent(true); // always show success — backend doesn't reveal email existence
        } catch {
            setFpError('Could not reach the server. Please try again.');
        } finally {
            setSending(false);
        }
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={handleOpen}
                className="text-xs text-blue-600 hover:underline font-medium"
            >
                Forgot password?
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100">
                <h2 className="text-base font-bold text-slate-800 mb-1">Reset your password</h2>

                {sent ? (
                    <>
                        <p className="text-sm text-slate-500 mb-4">
                            If that email is registered, a reset link has been sent. Check your inbox.
                        </p>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold"
                        >
                            Done
                        </button>
                    </>
                ) : (
                    <form onSubmit={handleSend} className="space-y-3 mt-3">
                        <p className="text-xs text-slate-500">
                            Enter your email and we'll send you a reset link.
                        </p>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="email"
                                required
                                value={fpEmail}
                                onChange={e => setFpEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>

                        {fpError && <p className="text-xs text-red-500">{fpError}</p>}

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={sending}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-60"
                            >
                                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Send Link
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

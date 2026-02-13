import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardLayout } from './components/DashboardLayout';
import { ToastProvider } from './context/ToastContext';
import { PublicLobby } from './pages/PublicLobby';
import { ControlRoom } from './pages/ControlRoom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { Analytics } from './pages/Analytics';
import { FinancialDashboard } from './pages/FinancialDashboard';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

interface User {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    school_id: string | null;
    school?: {
        id: string;
        name: string;
        type: string;
        district: string;
    } | null;
}

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, full_name: string, role: string, school_id?: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    // ⚡ Optimistic Update: Allow components to update user state directly if they have authoritative data
    updateUser: (user: User) => void;
    loading: boolean;
}

export const AuthContext = React.createContext<AuthContextType | null>(null);

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        const token = sessionStorage.getItem('auth_token');
        if (token) {
            try {
                const response = await fetch(`${API_BASE}/auth/verify`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();

                    // Rotate token if provided (Essential for permission updates)
                    if (data.token) {
                        sessionStorage.setItem('auth_token', data.token);
                    }

                    setUser(data.user);
                } else {
                    sessionStorage.removeItem('auth_token');
                    setUser(null);
                }
            } catch (error) {
                console.error('Token verification failed:', error);
                sessionStorage.removeItem('auth_token');
                setUser(null);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        refreshUser();

        // 💓 Auth Heartbeat: Check session validity every 60s
        // This ensures if a user is unassigned/archived in the background, their local state updates.
        const interval = setInterval(() => {
            refreshUser();
        }, 60000);

        // Note: Removed auto-logout on window close per user request
        // Session persists across page refreshes
        // Only logout when user explicitly clicks "Sign Out"

        return () => clearInterval(interval);
    }, []);

    const checkBackendHealth = async () => {
        try {
            const healthUrl = API_BASE.replace('/api/v1', '/health');
            const response = await fetch(healthUrl);
            if (response.ok) {
                return 'Backend is reachable.';
            }
            return 'Backend is running but /health returned an error. Check database connection logs.';
        } catch (error) {
            return 'Backend server is NOT REACHABLE. Please ensure you ran "npm run dev" in the backend folder and it started successfully on port 3001.';
        }
    };

    const login = async (email: string, password: string) => {
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Login failed');
            }

            const data = await response.json();
            sessionStorage.setItem('auth_token', data.token);
            setUser(data.user);
        } catch (error: any) {
            console.error('Login fetch error:', error);
            if (error.message === 'Failed to fetch') {
                const healthReport = await checkBackendHealth();
                throw new Error(`Connection Error: ${healthReport}`);
            }
            throw error;
        }
    };

    const register = async (email: string, password: string, full_name: string, role: string, school_id?: string) => {
        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, full_name, role, school_id }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Registration failed');
            }

            const data = await response.json();
            sessionStorage.setItem('auth_token', data.token);
            setUser(data.user);
        } catch (error: any) {
            console.error('Registration fetch error:', error);
            if (error.message === 'Failed to fetch') {
                const healthReport = await checkBackendHealth();
                throw new Error(`Connection Error: ${healthReport}`);
            }
            throw error;
        }
    };

    const logout = async () => {
        try {
            const token = sessionStorage.getItem('auth_token');
            if (token) {
                await fetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            sessionStorage.removeItem('auth_token');
            setUser(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
            </div>
        );
    }

    return (
        <ToastProvider>
            <AuthContext.Provider value={{ user, login, register, logout, refreshUser, updateUser: setUser, loading }}>
                <BrowserRouter>
                    <Layout>
                        <Routes>
                            <Route path="/" element={<PublicLobby />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />

                            {/* Protected Dashboard Routes */}
                            <Route path="/dashboard" element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
                                <Route index element={<Navigate to="overview" replace />} />
                                <Route path="overview" element={<OverviewDashboard />} />
                                <Route path="analytics" element={<Analytics />} />
                                <Route path="financial" element={<FinancialDashboard />} />
                                <Route path="alerts" element={<AlertsDashboard />} />
                                <Route path="manage" element={<ControlRoom />} />
                            </Route>

                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </Layout>
                </BrowserRouter>
            </AuthContext.Provider>
        </ToastProvider>
    );
};

export default App;

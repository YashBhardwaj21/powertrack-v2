import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardLayout } from './components/DashboardLayout';
import { PublicLobby } from './pages/PublicLobby';
import { ControlRoom } from './pages/ControlRoom'; // Kept for legacy ref use if needed
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { AnalyticsDashboard } from './pages/AnalyticsDashboard';
import { FinancialDashboard } from './pages/FinancialDashboard';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { ManagementDashboard } from './pages/ManagementDashboard';
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
    loading: boolean;
}

export const AuthContext = React.createContext<AuthContextType | null>(null);

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing token and verify it
        const verifyToken = async () => {
            const token = localStorage.getItem('auth_token');
            if (token) {
                try {
                    const response = await fetch(`${API_BASE}/auth/verify`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setUser(data.user);
                    } else {
                        localStorage.removeItem('auth_token');
                    }
                } catch (error) {
                    console.error('Token verification failed:', error);
                    localStorage.removeItem('auth_token');
                }
            }
            setLoading(false);
        };

        verifyToken();
    }, []);

    const checkBackendHealth = async () => {
        try {
            const healthUrl = API_BASE.replace('/api/v1', '/health');
            const response = await fetch(healthUrl);
            if (response.ok) {
                return 'Backend is running but API returned an error. Check database connection logs.';
            }
            return 'Backend is running but /health returned an error.';
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
            localStorage.setItem('auth_token', data.token);
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
            localStorage.setItem('auth_token', data.token);
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
            const token = localStorage.getItem('auth_token');
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
            localStorage.removeItem('auth_token');
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
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            <HashRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<PublicLobby />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />

                        {/* Protected Dashboard Routes */}
                        <Route path="/dashboard" element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
                            <Route index element={<Navigate to="overview" replace />} />
                            <Route path="overview" element={<OverviewDashboard />} />
                            <Route path="analytics" element={<AnalyticsDashboard />} />
                            <Route path="financial" element={<FinancialDashboard />} />
                            <Route path="alerts" element={<AlertsDashboard />} />
                            <Route path="manage" element={<ManagementDashboard />} />
                        </Route>

                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Layout>
            </HashRouter>
        </AuthContext.Provider>
    );
};

export default App;

import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Factory, LogOut, LayoutDashboard } from 'lucide-react';
import { AuthContext } from '../App';

export const AppHeader: React.FC = () => {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = async () => {
        if (auth?.logout) {
            await auth.logout();
            navigate('/');
        }
    };

    return (
        <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Logo Area - Always routes to Public Lobby */}
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-500 transition-colors">
                        <Factory className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-white font-semibold text-lg tracking-tight leading-none">PowerTrack</h1>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider leading-none mt-0.5">Enterprise v2.0</p>
                    </div>
                </Link>

                {/* Navigation Actions */}
                <div className="flex items-center gap-4">
                    {auth?.user ? (
                        <>
                            <Link
                                to="/dashboard"
                                className="hidden sm:flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <div className="h-6 w-px bg-slate-700 hidden sm:block" />
                            <div className="flex items-center gap-3">
                                <div className="text-right hidden md:block">
                                    <p className="text-white text-xs font-medium">{auth.user.full_name}</p>
                                    <p className="text-slate-500 text-[10px]">{auth.user.role}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-all text-xs font-medium border border-slate-700"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Sign Out
                                </button>
                            </div>
                        </>
                    ) : (
                        <Link
                            to="/login"
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg transition-all font-medium text-sm shadow-lg shadow-blue-900/20"
                        >
                            Staff Login
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
};

import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    BarChart3,
    Wallet,
    Bell,
    Settings,
    LogOut,
    Factory
} from 'lucide-react';
import { AuthContext } from '../App';

export const Sidebar: React.FC = () => {
    const auth = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = async () => {
        if (auth?.logout) {
            await auth.logout();
            navigate('/login');
        }
    };

    const navItems = [
        {
            path: '/dashboard/overview',
            icon: LayoutDashboard,
            label: auth?.user?.role === 'admin' ? 'Platform Overview' : 'School Overview'
        },
        { path: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/dashboard/financial', icon: Wallet, label: 'Financial & Impact' },
        { path: '/dashboard/alerts', icon: Bell, label: 'Alerts & Health' },
    ];

    // Only show Management to admins or if user has no school
    if (auth?.user?.role === 'admin' || !auth?.user?.school_id) {
        navItems.push({ path: '/dashboard/manage', icon: Settings, label: 'Management' });
    }

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-50">
            {/* Logo Area */}
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                    <Factory className="text-white w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-white font-bold text-lg tracking-tight">PowerTrack</h1>
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Enterprise v2.0</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                            ${isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 font-medium'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }
                        `}
                    >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User Profile & Logout */}
            <div className="p-4 border-t border-slate-800">
                <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                    <p className="text-white text-sm font-medium truncate">{auth?.user?.full_name || 'User'}</p>
                    <p className="text-slate-500 text-xs truncate mt-0.5">{auth?.user?.email}</p>
                    <p className="text-xs text-blue-400 mt-2 font-mono bg-blue-400/10 inline-block px-2 py-0.5 rounded">
                        {auth?.user?.role?.toUpperCase()}
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-slate-400 hover:text-white hover:bg-red-500/10 hover:text-red-400 px-4 py-2 rounded-lg w-full transition-all text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

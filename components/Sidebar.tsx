import React, { useContext } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    BarChart3,
    Wallet,
    Bell,
    Settings,
    LogOut,
    Factory,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';
import { AuthContext } from '../App';
import { useDashboard } from '../context/DashboardContext';

interface SidebarProps {
    onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
    const auth = useContext(AuthContext);
    const { data } = useDashboard();
    const navigate = useNavigate();

    const handleLogout = async () => {
        if (auth?.logout) {
            await auth.logout();
            navigate('/');
        }
    };

    const getSystemHealth = () => {
        const telemetry = data?.current_data || [];
        if (telemetry.length === 0) return 'never';

        // For individual school context
        const myTelemetry = auth?.user?.role === 'admin'
            ? telemetry.reduce((prev, current) => (prev.timestamp > current.timestamp) ? prev : current)
            : telemetry.find(d => d.school_id === auth?.user?.school_id);

        if (!myTelemetry) return 'never';

        const diff = Date.now() - new Date(myTelemetry.timestamp).getTime();

        // Detailed state logic
        if (diff < 600000) return 'online'; // 10 mins tolerance
        if (diff < 3600000) return 'stale'; // 1 hour
        return 'offline';
    };

    const health = getSystemHealth();

    const navItems = [
        {
            path: '/dashboard/overview',
            icon: LayoutDashboard,
            label: auth?.user?.role === 'admin' ? 'Network Overview' : 'Dashboard'
        },
        { path: '/dashboard/analytics', icon: BarChart3, label: 'Technical Center' },
        { path: '/dashboard/financial', icon: Wallet, label: 'Economy & Impact' },
        { path: '/dashboard/alerts', icon: Bell, label: 'Health Hub' },
        { path: '/dashboard/manage', icon: Settings, label: 'Control & Admin' },
    ];

    return (
        <aside className="w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
            {/* Logo Area */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity" onClick={onClose}>
                    <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/40">
                        <Factory className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-white font-semibold text-lg tracking-tight">PowerTrack</h1>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Enterprise Ingress</p>
                    </div>
                </Link>
                {/* Mobile Close Button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5 rotate-180" /> {/* Reusing LogOut icon as a 'back/close' indicator or use X if imported */}
                    </button>
                )}
            </div>

            {/* Global Status Indicator */}
            <div className="px-6 py-4 mt-2">
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${health === 'online' ? 'bg-emerald-500/5 border-emerald-500/20' :
                    health === 'stale' ? 'bg-amber-500/5 border-amber-500/20' :
                        'bg-slate-800/50 border-slate-700'
                    }`}>
                    <div className="relative">
                        <div className={`w-2.5 h-2.5 rounded-full ${health === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                            health === 'stale' ? 'bg-amber-500' :
                                health === 'offline' ? 'bg-red-500' :
                                    'bg-slate-500'
                            } ${health === 'online' ? 'animate-pulse' : ''}`} />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Status</span>
                            <span className={`text-[9px] font-bold uppercase py-0.5 px-1.5 rounded ${health === 'online' ? 'bg-emerald-500/10 text-emerald-400' :
                                health === 'stale' ? 'bg-amber-500/10 text-amber-500' :
                                    health === 'offline' ? 'bg-red-500/10 text-red-400' :
                                        'bg-slate-700 text-slate-400'
                                }`}>
                                {health === 'never' ? 'NOT SETUP' : health.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mt-1 truncate">
                            {health === 'online' ? 'Ingestion Active' :
                                health === 'stale' ? 'Delayed Sync' :
                                    health === 'offline' ? 'Connection Lost' :
                                        'No Data Stream'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto pt-2 pb-6 px-3 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group
                            ${isActive
                                ? 'bg-slate-800 text-white shadow-sm font-semibold'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                            }
                        `}
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                <span className="text-sm">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* User Profile & Logout */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="bg-slate-800/30 rounded-xl p-4 mb-4 border border-white/5">
                    <p className="text-white text-sm font-semibold truncate leading-none">{auth?.user?.full_name || 'User'}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${auth?.user?.role === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700 text-slate-400'
                            }`}>
                            {auth?.user?.role}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-slate-500 hover:text-red-400 hover:bg-red-500/5 px-4 py-2.5 rounded-xl w-full transition-all text-sm font-medium"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Terminate Session</span>
                </button>
            </div>
        </aside>
    );
};

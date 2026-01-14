
import React, { useContext } from 'react';
import { Sun, LogIn, LayoutDashboard, Globe, LogOut } from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { AuthContext } from '../App';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const auth = useContext(AuthContext);

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200 group-hover:rotate-12 transition-transform">
                                <Sun className="w-6 h-6 text-yellow-300" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">PowerTrack</h1>
                                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Sustainability League</p>
                            </div>
                        </Link>
                        
                        <nav className="flex items-center gap-4">
                            <NavLink to="/" className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}>
                                <Globe className="w-4 h-4" /> Lobby
                            </NavLink>
                            
                            {auth?.user ? (
                                <>
                                    <NavLink to="/dashboard" className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}>
                                        <LayoutDashboard className="w-4 h-4" /> Control Room
                                    </NavLink>
                                    <button onClick={auth.logout} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-red-500 hover:bg-red-50 transition-all">
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <Link to="/login" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2">
                                    <LogIn className="w-4 h-4" /> Staff Access
                                </Link>
                            )}
                        </nav>
                    </div>
                </div>
            </header>

            <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                {children}
            </main>

            <footer className="bg-white border-t border-slate-200 py-12 mt-12">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Sun className="text-blue-600 w-5 h-5" />
                        <span className="font-bold text-slate-900">PowerTrack Platform</span>
                    </div>
                    <div className="text-sm text-slate-400">© 2024 Education Sustainability Initiative. Verified Hardware Network.</div>
                </div>
            </footer>
        </div>
    );
};

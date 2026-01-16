
import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AuthContext } from '../App';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();
    const auth = useContext(AuthContext);

    // Pages that don't need the sidebar
    const publicPages = ['/', '/login', '/register'];
    const isPublicPage = publicPages.includes(location.pathname);
    const showSidebar = auth?.user && !isPublicPage;

    // Background for public pages vs dashboard
    const bgClass = isPublicPage ? 'bg-slate-900' : 'bg-slate-50';

    return (
        <div className={`min-h-screen ${bgClass} font-sans text-slate-800`}>
            {/* 
                Sidebar is now managed by DashboardLayout for authenticated pages.
                This Layout component handles the high-level routing shell.
            */}
            <main className="w-full">
                {children}
            </main>
        </div>
    );
};

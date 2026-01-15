
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
            {showSidebar && <Sidebar />}

            <main className={`transition-all duration-300 min-h-screen ${showSidebar ? 'ml-64 p-8' : ''}`}>
                <div className={`${showSidebar ? 'container mx-auto max-w-7xl' : 'w-full'}`}>
                    {children}
                </div>
            </main>
        </div>
    );
};

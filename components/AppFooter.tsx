import React from 'react';
import { Factory, Github, Twitter, Linkedin } from 'lucide-react';

export const AppFooter: React.FC = () => {
    return (
        <footer className="bg-slate-900 border-t border-slate-800 py-12 text-slate-400 text-sm">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="bg-blue-600 p-1.5 rounded-md">
                                <Factory className="text-white w-4 h-4" />
                            </div>
                            <span className="text-white font-bold text-lg tracking-tight">PowerTrack</span>
                        </div>
                        <p className="max-w-xs leading-relaxed text-slate-500">
                            Enterprise-grade solar monitoring and sustainability intelligence platform for educational institutions.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Resources</h4>
                        <ul className="space-y-2">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Documentation</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">API Reference</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">System Status</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Legal</h4>
                        <ul className="space-y-2">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Cookie Policy</a></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p>&copy; {new Date().getFullYear()} PowerTrack Enterprise. All rights reserved.</p>
                    <div className="flex items-center gap-4">
                        <a href="#" className="hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
                        <a href="#" className="hover:text-white transition-colors"><Twitter className="w-5 h-5" /></a>
                        <a href="#" className="hover:text-white transition-colors"><Linkedin className="w-5 h-5" /></a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className = ""
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 h-full ${className}`}>
            <div className="bg-slate-100 p-4 rounded-full mb-4">
                <Icon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-slate-900 font-semibold mb-1">{title}</h3>
            <p className="text-slate-500 text-sm max-w-xs mb-4">{description}</p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="text-blue-600 text-sm font-medium hover:text-blue-700 hover:underline underline-offset-4"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

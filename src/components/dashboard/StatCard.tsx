import React from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    trend?: string;
    trendLabel?: string;
    trendPositive?: boolean;
    statusColor?: string; // e.g. "text-green-500", "text-yellow-500"
    actionIcon?: React.ElementType;
}

export function StatCard({ title, value, icon: Icon, trend, trendLabel, trendPositive, statusColor, actionIcon: ActionIcon }: StatCardProps) {
    return (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between h-full relative group hover:border-zinc-300 dark:hover:border-zinc-600 transition-all shadow-sm dark:shadow-none">
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                    <span className="text-4xl font-bold text-foreground mb-1 font-brand">{value}</span>
                    <span className="text-sm text-muted-foreground font-medium">{title}</span>
                </div>
                <div className={cn("p-2 rounded-full bg-zinc-100 dark:bg-zinc-900/50 border border-border", statusColor)}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>

            {(trend || trendLabel) && (
                <div className="flex items-center text-xs mt-auto">
                    {trend && (
                        <span className={cn("font-medium flex items-center gap-1", trendPositive ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500")}>
                            {trendPositive ? '↗' : '↘'} {trend}
                        </span>
                    )}
                    {trendLabel && <span className="text-muted-foreground ml-1.5">{trendLabel}</span>}
                </div>
            )}

            {/* Optional Top Right Action Icon if needed, but the design shows the icon is the status indicator */}
        </div>
    );
}

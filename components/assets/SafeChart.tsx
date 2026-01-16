import React, { useState, useRef, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';

export const SafeChart = ({ data }: { data: any[] }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Use contentRect for broader compatibility
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    // Double RAF to ensure layout is fully stable
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setShouldRender(true);
                        });
                    });
                }
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full min-h-[1px] min-w-[1px]">
            {shouldRender ? (
                <ResponsiveContainer width="100%" height="100%" style={{ minWidth: 100, minHeight: 100 }}>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBal)" />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="w-full h-full bg-slate-50 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-300">
                    Loading Chart...
                </div>
            )}
        </div>
    );
};

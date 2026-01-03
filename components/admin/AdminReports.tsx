import React from 'react';
import { Report, Confession } from '../../types';
import { db } from '../../services/supabaseService';

interface AdminReportsProps {
    reports: Report[];
    confessions: Confession[];
    refresh: () => void;
}

export default function AdminReports({ reports, confessions, refresh }: AdminReportsProps) {
    const pending = reports.filter(r => r.status === 'pending');

    // Stub current admin ID for now
    const adminId = 'admin_user';

    const handleAction = async (id: string, action: 'resolved' | 'dismissed') => {
        await db.resolveReport(id, action, adminId);
        refresh();
    };

    return (
        <div className="space-y-6">
            <h3 className="font-bold text-slate-800 text-lg">Pending Reports ({pending.length})</h3>
            {pending.length === 0 && <p className="text-slate-400 text-sm">No pending reports. Good job!</p>}

            {pending.map(r => {
                const target = confessions.find(c => c.id === r.confessionId);
                return (
                    <div key={r.id} className="bg-white p-5 rounded-2xl shadow-soft border border-rose-100 flex flex-col gap-3 animate-slide-up relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1 block">Reported Reason</span>
                                <p className="font-bold text-slate-800">{r.reason}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">{new Date(r.timestamp).toLocaleDateString()}</span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-xs text-slate-500 font-medium mb-1">Reported Post Content:</p>
                            {target ? (
                                <p className="text-sm text-slate-700 italic">"{target.content}"</p>
                            ) : (
                                <p className="text-sm text-red-400">Post not found or already deleted.</p>
                            )}
                        </div>

                        <div className="flex gap-3 mt-2">
                            <button onClick={() => handleAction(r.id, 'resolved')} className="flex-1 bg-rose-50 text-rose-600 hover:bg-rose-100 py-2.5 rounded-xl text-xs font-bold transition-colors">
                                <i className="fas fa-check mr-2"></i> Resolve (Delete Post)
                            </button>
                            <button onClick={() => handleAction(r.id, 'dismissed')} className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-xl text-xs font-bold transition-colors">
                                <i className="fas fa-times mr-2"></i> Dismiss
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

import React, { useState } from 'react';
import { Confession } from '../../types';
import { db } from '../../services/supabaseService';

interface AdminContentProps {
    confessions: Confession[];
    refresh: () => void;
    confirmAction: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'info') => void;
}

export default function AdminContent({ confessions, refresh, confirmAction }: AdminContentProps) {
    const [search, setSearch] = useState('');

    const filtered = confessions.filter(c =>
        c.content.toLowerCase().includes(search.toLowerCase()) ||
        c.username.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        confirmAction(
            "Delete Post?",
            "Are you sure you want to delete this post? This action cannot be undone.",
            async () => {
                try {
                    await db.deleteConfession(id);
                    refresh();
                } catch (error: any) {
                    console.error('Delete confession error:', error);
                    alert(`Failed to delete confession: ${error.message || 'Unknown error'}`);
                }
            }
        );
    };

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <i className="fas fa-search text-slate-400"></i>
                <input className="bg-transparent outline-none w-full font-bold text-slate-700" placeholder="Search posts..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {filtered.map(c => (
                <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 animate-slide-up">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-xs text-slate-800">{c.username}</span>
                            <span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleDateString()}</span>
                            {c.isAnonymous && <span className="bg-slate-800 text-white text-[10px] px-1.5 rounded">ANON</span>}
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 rounded">{c.collegeId}</span>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 font-medium">{c.content}</p>
                    </div>
                    <button
                        onClick={() => handleDelete(c.id)}
                        className="h-full px-4 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1"
                    >
                        <i className="fas fa-trash"></i>
                        <span>Del</span>
                    </button>
                </div>
            ))}
        </div>
    );
}

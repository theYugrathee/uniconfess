import React, { useState } from 'react';
import { User } from '../../types';
import { db } from '../../services/supabaseService';

interface AdminUsersProps {
    users: User[];
    refresh: () => void;
}

export default function AdminUsers({ users, refresh }: AdminUsersProps) {
    const [search, setSearch] = useState('');

    const filtered = users.filter(u =>
        u.username?.toLowerCase().includes(search.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );

    const handleBan = async (id: string, isBanned: boolean) => {
        if (isBanned) await db.unbanUser(id);
        else await db.banUser(id);
        refresh();
    };

    return (
        <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center gap-4">
                <div className="flex-1 bg-slate-50 rounded-xl px-4 py-2 flex items-center gap-2">
                    <i className="fas fa-search text-slate-400"></i>
                    <input className="bg-transparent outline-none w-full text-sm font-bold text-slate-700" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span className="text-xs bg-slate-100 text-slate-500 px-3 py-2 rounded-xl font-bold whitespace-nowrap">{filtered.length} Users</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
                {filtered.map(u => (
                    <div key={u.id} className="p-4 flex items-center gap-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                        <img src={u.avatarUrl || 'https://ui-avatars.com/api/?name=User'} className="w-10 h-10 rounded-xl bg-slate-100 object-cover" />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-900 truncate flex items-center gap-2">
                                {u.displayName || u.username}
                                {u.isBanned && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase">Banned</span>}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleBan(u.id, !!u.isBanned)}
                                className={`h-8 px-3 rounded-lg flex items-center justify-center transition-colors font-bold text-xs ${u.isBanned ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                            >
                                {u.isBanned ? 'Unban' : 'Ban'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { db } from '../../services/supabaseService';
import { User, Confession, Report, College } from '../../types';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminContent from './AdminContent';
import AdminReports from './AdminReports';
import AdminColleges from './AdminColleges';
import AdminRequests from './AdminRequests';
import AdminAnnouncements from './AdminAnnouncements';
import AdminSettings from './AdminSettings';

interface AdminPanelProps {
    onBack: () => void;
    confirmAction: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'info') => void;
}

type AdminTab = 'overview' | 'users' | 'content' | 'reports' | 'colleges' | 'requests' | 'announcements' | 'settings';

export default function AdminPanel({ onBack, confirmAction }: AdminPanelProps) {
    const [tab, setTab] = useState<AdminTab>('overview');
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allConf, setAllConf] = useState<Confession[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [colleges, setColleges] = useState<College[]>([]);

    // Shared data loading
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [u, c, r, col] = await Promise.all([
            db.getAllUsers(),
            db.getAllConfessions(),
            db.getReports(),
            db.getColleges()
        ]);
        setAllUsers(u);
        setAllConf(c);
        setReports(r);
        setColleges(col);
    };

    return (
        <div className="px-4 lg:px-0 min-h-screen pb-20">
            <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50/90 backdrop-blur z-20 py-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-slate-100 transition-colors"><i className="fas fa-arrow-left text-slate-600"></i></button>
                    <div>
                        <h1 className="font-black text-2xl text-slate-900 leading-none">Admin Portal</h1>
                        <p className="text-xs text-slate-500 font-medium mt-1">System Overview & Controls</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Live</div>
                </div>
            </div>

            {/* Admin Tabs */}
            <div className="flex gap-1 bg-white p-1.5 rounded-2xl shadow-sm mb-6 w-full overflow-x-auto no-scrollbar">
                {['overview', 'users', 'content', 'reports', 'colleges', 'requests', 'announcements', 'settings'].map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t as AdminTab)}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold capitalize transition-all whitespace-nowrap ${tab === t ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="animate-slide-up">
                {tab === 'overview' && <AdminDashboard users={allUsers} confessions={allConf} reports={reports} colleges={colleges} />}
                {tab === 'users' && <AdminUsers users={allUsers} refresh={loadData} />}
                {tab === 'content' && <AdminContent confessions={allConf} refresh={loadData} confirmAction={confirmAction} />}
                {tab === 'reports' && <AdminReports reports={reports} confessions={allConf} refresh={loadData} />}
                {tab === 'colleges' && <AdminColleges colleges={colleges} refresh={loadData} confirmAction={confirmAction} />}
                {tab === 'requests' && <AdminRequests refresh={loadData} confirmAction={confirmAction} />}
                {tab === 'announcements' && <AdminAnnouncements colleges={colleges} confirmAction={confirmAction} />}
                {tab === 'settings' && <AdminSettings />}
            </div>
        </div>
    );
}

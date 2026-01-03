import React from 'react';
import { User, Confession, Report, College } from '../../types';

interface AdminDashboardProps {
    users: User[];
    confessions: Confession[];
    reports: Report[];
    colleges: College[];
}

export default function AdminDashboard({ users, confessions, reports, colleges }: AdminDashboardProps) {
    return (
        <div className="animate-slide-up">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-5 rounded-3xl shadow-soft border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-3"><i className="fas fa-users"></i></div>
                    <p className="text-3xl font-black text-slate-800">{users.length}</p>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-soft border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-500 flex items-center justify-center mb-3"><i className="fas fa-layer-group"></i></div>
                    <p className="text-3xl font-black text-slate-800">{confessions.length}</p>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Posts</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-soft border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center mb-3"><i className="fas fa-university"></i></div>
                    <p className="text-3xl font-black text-slate-800">{colleges.length}</p>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Colleges</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-soft border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-500 flex items-center justify-center mb-3"><i className="fas fa-exclamation-triangle"></i></div>
                    <p className="text-3xl font-black text-slate-800">{reports.length}</p>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Reports</p>
                </div>
            </div>

            {/* College Distribution */}
            <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100 mb-6">
                <h3 className="font-bold text-lg text-slate-800 mb-4">Students per College</h3>
                <div className="space-y-4">
                    {colleges.map(c => {
                        const count = users.filter(u => u.collegeId === c.id).length;
                        const percentage = users.length ? (count / users.length) * 100 : 0;
                        return (
                            <div key={c.id}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-bold text-slate-700">{c.name}</span>
                                    <span className="text-slate-500 font-medium">{count} students</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div className="bg-primary-500 h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}

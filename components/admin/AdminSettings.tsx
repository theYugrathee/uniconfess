import React from 'react';
import { db } from '../../services/supabaseService';
import { User, Confession } from '../../types';

export default function AdminSettings() {

    const exportData = async (type: 'users' | 'confessions') => {
        let data: any[] = [];
        let filename = '';

        if (type === 'users') {
            data = await db.getAllUsers();
            filename = `users_export_${Date.now()}.csv`;
        } else {
            data = await db.getAllConfessions();
            filename = `confessions_export_${Date.now()}.csv`;
        }

        if (data.length === 0) {
            alert('No data to export.');
            return;
        }

        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(val =>
            typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
        ).join(','));
        const csvContent = [headers, ...rows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
                <h3 className="font-bold text-lg text-slate-800 mb-4">Data Export</h3>
                <p className="text-slate-500 text-sm mb-6">Download system data for backup or analysis.</p>
                <div className="flex gap-4">
                    <button onClick={() => exportData('users')} className="flex items-center gap-3 px-6 py-3 bg-slate-50 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all group">
                        <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"><i className="fas fa-file-csv"></i></div>
                        <div className="text-left">
                            <span className="block font-bold text-slate-700 text-sm">Export Users</span>
                            <span className="block text-xs text-slate-400">CSV Format</span>
                        </div>
                    </button>
                    <button onClick={() => exportData('confessions')} className="flex items-center gap-3 px-6 py-3 bg-slate-50 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all group">
                        <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"><i className="fas fa-file-csv"></i></div>
                        <div className="text-left">
                            <span className="block font-bold text-slate-700 text-sm">Export Posts</span>
                            <span className="block text-xs text-slate-400">CSV Format</span>
                        </div>
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
                <h3 className="font-bold text-lg text-slate-800 mb-4">Security</h3>
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                        <p className="font-bold text-slate-700 text-sm">Change Admin Password</p>
                        <p className="text-xs text-slate-500">Update your account credentials.</p>
                    </div>
                    <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">Manage</button>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import { College } from '../../types';
import { db } from '../../services/supabaseService';

interface AdminCollegesProps {
    colleges: College[];
    refresh: () => void;
    confirmAction: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'info') => void;
}

export default function AdminColleges({ colleges, refresh, confirmAction }: AdminCollegesProps) {
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await db.addCollege(newName);
        setNewName('');
        refresh();
    };

    const handleStartEdit = (college: College) => {
        setEditingId(college.id);
        setEditName(college.name);
    };

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim()) return;
        await db.updateCollege(id, editName);
        setEditingId(null);
        setEditName('');
        refresh();
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleDelete = async (id: string) => {
        confirmAction(
            "Delete College?",
            "Are you sure you want to delete this college? This action cannot be undone.",
            async () => {
                try {
                    await db.deleteCollege(id);
                    refresh();
                } catch (error: any) {
                    console.error('Delete college error:', error);
                    alert(`Failed to delete college: ${error.message || 'Unknown error'}`);
                }
            }
        );
    };

    return (
        <div className="animate-slide-up">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 relative">
                <div className="flex gap-2">
                    <input
                        className="flex-1 bg-slate-50 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary-100 transition-all placeholder-slate-400"
                        placeholder="New College Name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !colleges.some(c => c.name.toLowerCase() === newName.trim().toLowerCase()) && handleAdd()}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newName.trim() || colleges.some(c => c.name.toLowerCase() === newName.trim().toLowerCase())}
                        className="bg-slate-900 text-white px-6 rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none"
                    >
                        <i className="fas fa-plus mr-2"></i>Add
                    </button>
                </div>

                {/* Search Results / Feedback */}
                {newName.trim().length > 1 && (
                    <div className="mt-4 animate-fade-in">
                        {(() => {
                            const lowerQuery = newName.trim().toLowerCase();
                            const matches = colleges.filter(c => c.name.toLowerCase().includes(lowerQuery));
                            const exactMatch = colleges.find(c => c.name.toLowerCase() === lowerQuery);

                            if (matches.length > 0) {
                                return (
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Similar Colleges Found</p>
                                        {matches.map(c => (
                                            <div key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border ${c.name.toLowerCase() === lowerQuery ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm">
                                                    <i className="fas fa-university text-xs"></i>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className={`block font-bold truncate ${c.name.toLowerCase() === lowerQuery ? 'text-rose-600' : 'text-slate-700'}`}>{c.name}</span>
                                                </div>
                                                {c.name.toLowerCase() === lowerQuery && (
                                                    <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-1 rounded-md">EXISTS</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            } else {
                                return (
                                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl border border-green-100">
                                        <i className="fas fa-check-circle"></i>
                                        <span className="text-sm font-bold">No college found with this name. Safe to add.</span>
                                    </div>
                                );
                            }
                        })()}
                    </div>
                )}
            </div>

            <div className="space-y-3">
                {colleges.map(c => (
                    <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center group">
                        {editingId === c.id ? (
                            <>
                                <input
                                    className="flex-1 bg-slate-50 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveEdit(c.id)}
                                    autoFocus
                                />
                                <div className="flex gap-2 ml-2">
                                    <button onClick={() => handleSaveEdit(c.id)} className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors">
                                        <i className="fas fa-check text-xs"></i>
                                    </button>
                                    <button onClick={handleCancelEdit} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors">
                                        <i className="fas fa-times text-xs"></i>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                                        <i className="fas fa-university text-sm"></i>
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-800 block">{c.name}</span>
                                        <span className="text-xs text-slate-400 font-medium">ID: {c.id}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleStartEdit(c)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors">
                                        <i className="fas fa-edit text-xs"></i>
                                    </button>
                                    <button onClick={() => handleDelete(c.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                                        <i className="fas fa-trash text-xs"></i>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {colleges.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <i className="fas fa-university text-4xl mb-3 opacity-30"></i>
                    <p className="font-medium">No colleges yet. Add one to get started!</p>
                </div>
            )}
        </div>
    );
}

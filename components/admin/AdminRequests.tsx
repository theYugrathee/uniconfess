import React, { useState, useEffect } from 'react';
import { CollegeRequest } from '../../types';
import { db } from '../../services/supabaseService';
import Button from '../Button';

interface AdminRequestsProps {
    refresh: () => void;
    confirmAction: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'info') => void;
}

export default function AdminRequests({ refresh, confirmAction }: AdminRequestsProps) {
    const [requests, setRequests] = useState<CollegeRequest[]>([]);
    const [reviewing, setReviewing] = useState<CollegeRequest | null>(null);
    const [editName, setEditName] = useState('');
    const [editLocation, setEditLocation] = useState('');

    useEffect(() => {
        loadRequests();
        const sub = db.subscribeToCollegeRequests(() => {
            loadRequests();
        });
        return () => {
            sub.unsubscribe();
        };
    }, []);

    const loadRequests = async () => {
        const data = await db.getCollegeRequests();
        setRequests(data);
    };

    const handleStartReview = (req: CollegeRequest) => {
        setReviewing(req);
        setEditName(req.name);
        setEditLocation(req.location);
    };

    const handleApprove = async () => {
        if (!reviewing) return;
        try {
            await db.approveCollegeRequest(reviewing.id, editName);
            setReviewing(null);
            loadRequests();
            refresh();
        } catch (e) {
            alert('Failed to approve');
        }
    };

    const handleReject = async (req: CollegeRequest) => {
        confirmAction(
            "Reject Request?",
            `Are you sure you want to reject and delete the request for "${req.name}"?`,
            async () => {
                try {
                    await db.rejectCollegeRequest(req.id);
                    if (reviewing?.id === req.id) setReviewing(null);
                    loadRequests();
                } catch (e) {
                    alert('Failed to reject');
                }
            }
        );
    };

    if (reviewing) {
        return (
            <div className="animate-scale-in max-w-lg mx-auto bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setReviewing(null)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h2 className="font-black text-2xl text-slate-900">Review Request</h2>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">College Name</label>
                        <input
                            className="premium-input"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Location</label>
                        <input
                            className="premium-input bg-slate-50 text-slate-500 cursor-not-allowed"
                            value={editLocation}
                            disabled
                        />
                        <p className="text-[10px] text-slate-400 mt-1 italic">Location is for reference only during manual addition.</p>
                    </div>

                    <div className="pt-6 border-t border-slate-50 grid grid-cols-2 gap-3">
                        <Button variant="secondary" className="bg-rose-50 text-rose-600 hover:bg-rose-100 border-none rounded-xl" onClick={() => handleReject(reviewing)}>Reject & Delete</Button>
                        <Button className="bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-glow py-3" onClick={handleApprove}>Add College</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-slide-up">
            <h2 className="font-bold text-xl mb-4 text-slate-800">Pending College Requests</h2>
            {requests.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                    <i className="fas fa-inbox text-4xl mb-3 opacity-30"></i>
                    <p className="font-medium">No pending requests.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(r => (
                        <div key={r.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center group hover:border-primary-100 transition-colors">
                            <div onClick={() => handleStartReview(r)} className="cursor-pointer flex-1">
                                <h4 className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">{r.name}</h4>
                                <p className="text-sm text-slate-500"><i className="fas fa-map-marker-alt mr-1"></i> {r.location}</p>
                                <p className="text-xs text-slate-400 mt-1">Requested by user: {r.requestedBy}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleReject(r)}
                                    className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors flex items-center justify-center"
                                    title="Reject & Delete"
                                >
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                                <Button onClick={() => handleStartReview(r)} className="bg-slate-900 hover:bg-black text-white rounded-xl px-6">Review</Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

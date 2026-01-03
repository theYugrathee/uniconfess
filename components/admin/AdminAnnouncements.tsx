import React, { useState } from 'react';
import { College } from '../../types';
import { db } from '../../services/supabaseService';
import Button from '../Button';

interface AdminAnnouncementsProps {
    colleges: College[];
    confirmAction: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'info') => void;
}

export default function AdminAnnouncements({ colleges, confirmAction }: AdminAnnouncementsProps) {
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [targetCollege, setTargetCollege] = useState<string>('all');
    const [sending, setSending] = useState(false);

    const handleSendBroadcast = async () => {
        if (!broadcastMsg.trim()) return;
        confirmAction(
            "Send Broadcast?",
            `Are you sure you want to send this message to ${targetCollege === 'all' ? 'ALL users' : 'users in the selected college'}? This will notify everyone immediately.`,
            async () => {
                setSending(true);
                try {
                    await db.sendSystemNotification(broadcastMsg, targetCollege === 'all' ? undefined : targetCollege);
                    alert('Broadcast sent successfully!');
                    setBroadcastMsg('');
                } catch (e) {
                    console.error(e);
                    alert('Failed to send broadcast');
                } finally {
                    setSending(false);
                }
            },
            'info'
        );
    };

    return (
        <div className="animate-slide-up max-w-2xl mx-auto">
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 mb-6">
                <div className="flex items-center gap-3 mb-4 text-amber-800">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl">
                        <i className="fas fa-bullhorn"></i>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">System Broadcast</h3>
                        <p className="text-sm opacity-80">Send a notification to all users or a specific campus.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-amber-800/70 mb-2 uppercase tracking-wide">Target Audience</label>
                        <select
                            className="w-full bg-white border border-amber-200 text-slate-800 p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-200 font-bold"
                            value={targetCollege}
                            onChange={e => setTargetCollege(e.target.value)}
                        >
                            <option value="all">🌍 All Users (System Wide)</option>
                            <optgroup label="Specific Campuses">
                                {colleges.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-amber-800/70 mb-2 uppercase tracking-wide">Message Content</label>
                        <textarea
                            className="w-full h-32 bg-white border border-amber-200 text-slate-800 p-4 rounded-xl outline-none focus:ring-2 focus:ring-amber-200 font-medium resize-none"
                            placeholder="Type your announcement here..."
                            value={broadcastMsg}
                            onChange={e => setBroadcastMsg(e.target.value)}
                        />
                        <div className="text-right text-xs font-bold mt-1 text-amber-800/60">
                            {broadcastMsg.length}/500
                        </div>
                    </div>

                    <Button
                        onClick={handleSendBroadcast}
                        disabled={!broadcastMsg.trim() || sending}
                        isLoading={sending}
                        className="w-full py-4 text-lg bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-600/20"
                    >
                        Send Broadcast
                    </Button>
                </div>
            </div>
        </div>
    );
}

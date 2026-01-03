import React, { useState, useEffect } from 'react';
import { User, College, AppView } from '../types';
import { db } from '../services/supabaseService';
import Button from './Button';

interface SetupCollegeViewProps {
    user: User | null;
    colleges: College[];
    setColleges: (c: College[]) => void;
    setView: (v: AppView) => void;
    setUser: (u: User | null) => void;
}

export const SetupCollegeView: React.FC<SetupCollegeViewProps> = ({ user, colleges, setColleges, setView, setUser }) => {
    const [search, setSearch] = useState('');
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [reqName, setReqName] = useState('');
    const [reqLoc, setReqLoc] = useState('');
    const [reqSent, setReqSent] = useState(false);

    // Initial fetch backup
    useEffect(() => {
        const load = async () => {
            // Only fetch if empty? Or always to be safe?
            // Let's rely on parent mostly, but fetching here doesn't hurt if we set parent state
            if (colleges.length === 0) {
                const c = await db.getColleges();
                setColleges(c);
            }
        };
        load();
    }, []);

    const filtered = search.trim().length > 0
        ? (colleges || []).filter(c => c?.name?.toLowerCase().includes(search.toLowerCase()))
        : [];

    const handleRequestSubmit = async () => {
        if (!reqName.trim() || !reqLoc.trim() || !user) return;
        await db.requestCollege(reqName, reqLoc, user.id);
        setReqSent(true);
        setTimeout(() => {
            setReqSent(false);
            setShowRequestForm(false);
            setReqName('');
            setReqLoc('');
        }, 10000);
    };

    if (showRequestForm) return (
        <div className="min-h-screen bg-white p-6 flex flex-col animate-slide-up">
            <button onClick={() => setShowRequestForm(false)} className="self-start mb-6 text-slate-500 hover:text-slate-800 font-bold"><i className="fas fa-arrow-left mr-2"></i>Back to Search</button>
            <h2 className="text-3xl font-black mb-2 text-slate-900">Request College</h2>
            <p className="text-slate-500 mb-8">Tell us about your college and we'll add it within 24 hours.</p>

            {reqSent ? (
                <div className="bg-green-50 p-8 rounded-3xl text-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce"><i className="fas fa-check"></i></div>
                    <h3 className="font-bold text-green-800 text-xl mb-2">Request Sent Successfully!</h3>
                    <p className="text-green-600 font-bold">
                        Our admin team review it. and your college will be added within 24 hour.
                        <span className="block mt-2 opacity-70 text-sm">Please wait while we redirect you...</span>
                    </p>
                </div>
            ) : (
                <div className="space-y-4 max-w-md mx-auto w-full">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">College Name</label>
                        <input className="w-full bg-slate-50 p-4 rounded-xl outline-none font-bold" placeholder="e.g. Baba Institute" value={reqName} onChange={e => setReqName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Location (City, State)</label>
                        <input className="w-full bg-slate-50 p-4 rounded-xl outline-none font-bold" placeholder="e.g. Visakhapatnam, AP" value={reqLoc} onChange={e => setReqLoc(e.target.value)} />
                    </div>
                    <Button className="w-full py-4 text-lg rounded-xl mt-4" onClick={handleRequestSubmit} disabled={!reqName || !reqLoc}>Submit Request</Button>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 animate-fade-in">
            <h2 className="text-3xl font-black mb-2 mt-4 text-slate-900">Find Your Tribe</h2>
            <p className="text-slate-500 mb-8">Search for your university to join.</p>
            <div className="bg-white p-4 rounded-2xl shadow-soft mb-6 flex items-center gap-3 sticky top-4 z-10 border border-slate-100">
                <i className="fas fa-search text-slate-400 ml-2"></i>
                <input
                    className="w-full outline-none font-medium text-lg"
                    placeholder="Search schools..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="space-y-3 pb-20">
                {filtered.map(c => (
                    <div key={c.id} onClick={async () => {
                        if (user) {
                            const updated = await db.updateUser(user.id, { collegeId: c.id });
                            setUser(updated); // Critical: Update local state to trigger feed subscription
                            setView(AppView.HOME);
                        }
                    }} className="p-5 bg-white rounded-2xl shadow-sm border border-transparent hover:border-orange-200 cursor-pointer transition-all flex justify-between items-center group">
                        <div>
                            <span className="font-bold text-slate-800 group-hover:text-orange-600 block text-lg">{c.name}</span>
                            {c.location && <span className="text-xs text-slate-400 font-bold uppercase tracking-wide"><i className="fas fa-map-marker-alt mr-1"></i> {c.location}</span>}
                        </div>
                        <i className="fas fa-arrow-right text-slate-300 group-hover:text-orange-500"></i>
                    </div>
                ))}
                {filtered.length === 0 && !search.trim() && (
                    <div className="text-center py-20 opacity-50">
                        <i className="fas fa-search text-4xl text-slate-300 mb-4 animate-bounce"></i>
                        <p className="font-bold text-slate-900 text-lg">Start typing to search...</p>
                        <p className="text-slate-400 text-sm mt-1">Find your campus by name.</p>
                    </div>
                )}
                {filtered.length === 0 && search && (
                    <div className="text-center py-10">
                        <p className="font-bold text-slate-400 mb-4">College not found?</p>
                        <Button variant="secondary" onClick={() => setShowRequestForm(true)} className="bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-100">Request to Add College</Button>
                    </div>
                )}
            </div>

            <div className="mt-auto pt-12 pb-10 text-center">
                <button
                    onClick={async () => {
                        await db.logout();
                        setUser(null);
                        setView(AppView.AUTH);
                    }}
                    className="text-rose-500 text-base font-black transition-all uppercase tracking-widest px-10 py-4 bg-white rounded-2xl border border-slate-200 shadow-md inline-flex items-center gap-3 active:scale-95 hover:bg-slate-50"
                >
                    <i className="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            </div>
        </div>
    );
};

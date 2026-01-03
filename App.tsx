import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from './services/supabaseService'; // Correct import
import { onAuthStateChanged } from 'firebase/auth'; // Firebase Auth Listener
import { useClerk } from '@clerk/clerk-react'; // Keep useClerk for signOut cleanup if needed
import { supabase } from './services/supabaseClient';
import { polishConfession } from './services/geminiService';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { User, Confession, College, Message, AppView, Toast, Comment, Notification as AppNotification } from './types';
import Button from './components/Button';
import AdminPanel from './components/admin/AdminPanel';
import { AppLogo } from './components/AppLogo';
import { AuthView } from './components/AuthView';
import { SetupCollegeView } from './components/SetupCollegeView';
import ConfirmModal from './components/ConfirmModal';

const NavIcon = ({ active, icon, label, onClick, badge }: any) => (
    <button
        onClick={onClick}
        className={`social-nav-item w-full group relative overflow-hidden transition-all duration-300 ${active ? 'social-nav-item-active' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
    >
        <div className={`relative z-10 text-xl w-6 flex justify-center items-center transition-colors duration-300 ${active ? 'text-primary-600' : 'text-slate-500'}`}>
            {icon}
            {badge > 0 && <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] h-4 w-4 rounded-full flex items-center justify-center shadow-sm border-2 border-white">{badge}</span>}
        </div>
        <span className={`hidden lg:block relative z-10 tracking-tight transition-all duration-300`}>{label}</span>
        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange-600 rounded-r-full shadow-glow animate-fade-in"></div>}
    </button>
);

// --- Extracted Components ---

interface ConfessionItemProps {
    confession: Confession;
    currentUser: User | null;
    isAdminView?: boolean;
    onLike: (id: string, currentlyLiked: boolean) => Promise<void>;
    onDelete: (confession: Confession) => Promise<void>;
    onReply: (id: string) => void;
    onShare: (confession: Confession) => void;
    onProfileClick: (userId: string, isAnonymous: boolean) => void;
    onReport: (id: string) => void;
    hideSocials?: boolean;
}

const ConfessionItem: React.FC<ConfessionItemProps> = React.memo(({
    confession,
    currentUser,
    isAdminView = false,
    onLike,
    onDelete,
    onReply,
    onShare,
    onProfileClick,
    onReport,
    hideSocials = false
}) => {
    const [liked, setLiked] = useState(confession.likes ? confession.likes.includes(currentUser?.id || '') : false);
    const [count, setCount] = useState(confession.likes ? confession.likes.length : 0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setLiked(confession.likes ? confession.likes.includes(currentUser?.id || '') : false);
        setCount(confession.likes ? confession.likes.length : 0);
    }, [confession.likes, currentUser]);

    const isLong = confession.content.length > 200;
    const displayContent = expanded || !isLong ? confession.content : confession.content.substring(0, 200) + '...';

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;

        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);

        const isLiking = !liked;
        setLiked(isLiking);
        setCount(prev => isLiking ? prev + 1 : prev - 1);

        try {
            await onLike(confession.id, !isLiking);
        } catch (err) {
            setLiked(!isLiking);
            setCount(prev => isLiking ? prev - 1 : prev + 1);
        }
    };

    const handleDeleteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (onDelete) await onDelete(confession);
    }

    const displayName = confession.isAnonymous ? 'Anonymous Member' : confession.username;
    const isAnon = confession.isAnonymous;
    const isOwner = currentUser && currentUser.id === confession.userId;
    const isAdmin = currentUser && (currentUser.id === 'admin_user' || currentUser.isAdmin || currentUser.email === 'admin@yug.com');
    const canDelete = isAdminView || isOwner || isAdmin;

    return (
        <div className={`p-5 mb-0 transition-colors relative group animate-fade-in border-b border-slate-100/60 ${isAdminView ? '' : 'hover:bg-slate-50/50 cursor-pointer'}`} onClick={() => !isAdminView && !hideSocials && onReply(confession.id)}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm overflow-hidden transition-transform duration-300 ${isAnon ? 'bg-slate-900' : 'cursor-pointer hover:scale-105'}`}
                        onClick={(e) => { e.stopPropagation(); onProfileClick(confession.userId, isAnon); }}
                    >
                        {isAnon ? <i className="fas fa-mask text-white text-xs"></i> : <img src={confession.userAvatar || `https://ui-avatars.com/api/?name=${confession.username || 'User'}`} className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-[15px] leading-tight flex items-center gap-2 truncate">
                            {displayName}
                            {isAdminView && <span className="bg-rose-50 text-rose-600 text-[10px] px-2 py-0.5 rounded-full border border-rose-100 font-bold">ADMIN</span>}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">{new Date(confession.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                </div>

                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <i className="fas fa-ellipsis-h text-sm"></i>
                    </button>
                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}></div>
                            <div className="absolute right-0 top-10 bg-white shadow-premium rounded-2xl border border-slate-100 w-40 py-2 z-20 overflow-hidden animate-slide-up origin-top-right ring-1 ring-black/5">
                                {canDelete && (
                                    <button className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 font-semibold transition-colors flex items-center gap-2" onClick={handleDeleteClick}>
                                        <i className="far fa-trash-alt"></i> Delete Post
                                    </button>
                                )}
                                <button className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 font-medium transition-colors flex items-center gap-2" onClick={(e) => { e.stopPropagation(); onReport(confession.id); setMenuOpen(false); }}>
                                    <i className="far fa-flag"></i> Report Issue
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="text-slate-800 text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                {displayContent}
                {isLong && !expanded && (
                    <button onClick={(e) => { e.stopPropagation(); setExpanded(true); }} className="text-orange-600 font-bold ml-1 hover:underline">
                        See more
                    </button>
                )}
            </div>

            {!isAdminView && !hideSocials && (
                <div className="mt-4 flex items-center gap-6 text-slate-500">
                    <button
                        className={`flex items-center gap-2 text-sm font-semibold transition-all duration-200 group/btn ${liked ? 'text-rose-500' : 'hover:text-rose-500'}`}
                        onClick={handleLike}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${liked ? 'bg-rose-50' : 'group-hover/btn:bg-rose-50'}`}>
                            <i className={`${liked ? 'fas' : 'far'} fa-heart ${isAnimating ? 'animate-scale-in' : ''}`}></i>
                        </div>
                        <span>{count || ''}</span>
                    </button>

                    <button
                        className="flex items-center gap-2 text-sm font-semibold transition-all duration-200 group/btn hover:text-orange-600"
                        onClick={(e) => { e.stopPropagation(); onReply(confession.id); }}
                    >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover/btn:bg-primary-50">
                            <i className="far fa-comment"></i>
                        </div>
                    </button>

                    <button
                        className="flex items-center gap-2 text-sm font-semibold transition-all duration-200 group/btn hover:text-blue-600 ml-auto"
                        onClick={(e) => { e.stopPropagation(); onShare(confession); }}
                    >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover/btn:bg-blue-50">
                            <i className="far fa-share-square"></i>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
});

interface EditProfileViewProps {
    user: User;
    onSave: (updates: Partial<User>) => void;
    onCancel: () => void;
}

const ManageAccountView = ({ user, onSave, onDelete, onCancel, confirmAction }: { user: User, onSave: (updates: Partial<User>) => Promise<void>, onDelete: () => Promise<void>, onCancel: () => void, confirmAction: (title: string, msg: string, onConfirm: () => void, type?: 'danger' | 'info') => void }) => {
    const [bio, setBio] = useState(user.bio || '');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    return (
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden animate-scale-in flex flex-col border border-white/50 relative">
            <div className="p-8 pb-4">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h3 className="font-extrabold text-2xl text-slate-900">Manage Account</h3>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">About You (Bio)</label>
                        <textarea
                            className="premium-input min-h-[120px] resize-none"
                            placeholder="Tell the campus a bit about yourself..."
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            maxLength={160}
                        />
                        <div className="text-right text-[10px] font-bold text-slate-400 mt-1">{bio.length}/160</div>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                        <Button
                            className="w-full rounded-xl py-3 shadow-glow"
                            onClick={async () => {
                                setSaving(true);
                                await onSave({ bio });
                                setSaving(false);
                            }}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Update Bio'}
                        </Button>
                    </div>

                    <div className="pt-8 mt-4 border-t border-rose-50">
                        <h4 className="text-rose-600 font-black text-xs uppercase tracking-widest mb-4">Danger Zone</h4>
                        <button
                            onClick={async () => {
                                confirmAction(
                                    "Delete Account?",
                                    "ARE YOU SURE? This will permanently delete your account and all your confessions, messages, and comments. This cannot be undone.",
                                    async () => {
                                        setDeleting(true);
                                        await onDelete();
                                        setDeleting(false);
                                    },
                                    'danger'
                                );
                            }}
                            disabled={deleting}
                            className="w-full text-rose-500 text-sm font-black transition-all uppercase tracking-widest px-8 py-3 bg-rose-50/50 rounded-2xl border border-rose-100 hover:bg-rose-50 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-trash-alt"></i>
                            {deleting ? 'Deleting Account...' : 'Delete My Account Permanently'}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-3 text-center px-4 leading-relaxed italic">Once deleted, your stories will be gone from the campus forever.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingsView = ({ user, onClose, onLogout, setSubView, confirmAction }: { user: User, onClose: () => void, onLogout: () => void, setSubView: (v: 'manage' | 'avatar' | null) => void, confirmAction: (title: string, msg: string, onConfirm: () => void, type?: 'danger' | 'info') => void }) => {
    return (
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-auto overflow-hidden animate-scale-in flex flex-col border border-white/50 relative">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-extrabold text-xl text-slate-900">Settings</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-colors">
                    <i className="fas fa-times"></i>
                </button>
            </div>

            <div className="p-4 space-y-2">
                <button
                    onClick={() => setSubView('avatar')}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 transition-colors group"
                >
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                        <i className="far fa-user-circle text-lg"></i>
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-slate-900">Change Avatar</p>
                        <p className="text-xs text-slate-400">Update your profile photo</p>
                    </div>
                    <i className="fas fa-chevron-right text-slate-300 text-sm ml-auto group-hover:translate-x-1 transition-transform"></i>
                </button>

                <button
                    onClick={() => setSubView('manage')}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 transition-colors group"
                >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                        <i className="fas fa-fingerprint text-lg"></i>
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-slate-900">Manage Account</p>
                        <p className="text-xs text-slate-400">Bio, privacy, and account deletion</p>
                    </div>
                    <i className="fas fa-chevron-right text-slate-300 text-sm ml-auto group-hover:translate-x-1 transition-transform"></i>
                </button>

                <div className="pt-4 mt-2 border-t border-slate-50">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-rose-50 text-rose-500 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100">
                            <i className="fas fa-sign-out-alt text-lg"></i>
                        </div>
                        <p className="font-black uppercase tracking-widest text-xs">Logout</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

const EditProfileView: React.FC<EditProfileViewProps> = ({ user, onSave, onCancel }) => {
    const [selectedUrl, setSelectedUrl] = useState<string>(user.avatarUrl || '');
    const seeds = ['Felix', 'Aneka', 'Zack', 'Midnight', 'Bear', 'Tech', 'Chill', 'Vibe', 'Cool', 'Snap', 'Luna', 'Max', 'Sam', 'Leo', 'Mia'];

    return (
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden animate-scale-in flex flex-col border border-white/50 relative">
            <div className="p-8 pb-4 text-center">
                <div className="flex items-center gap-4 mb-2">
                    <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h3 className="font-extrabold text-2xl text-slate-900">Update Avatar</h3>
                </div>
                <p className="text-slate-500 text-sm">Choose a new look for the campus.</p>
            </div>
            <div className="p-6 pt-2 flex flex-col items-center space-y-6">
                <div className="w-28 h-28 rounded-2xl bg-primary-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-soft transform hover:scale-105 transition-transform duration-300">
                    <img src={selectedUrl || `https://ui-avatars.com/api/?name=${user.username || 'User'}`} className="w-full h-full object-cover" />
                </div>

                <div className="w-full space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Avatar URL (Custom Image Link)</label>
                        <input
                            className="premium-input"
                            placeholder="Paste an image link here..."
                            value={selectedUrl}
                            onChange={e => setSelectedUrl(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Quick Presets</label>
                        <div className="w-full overflow-x-auto no-scrollbar py-2">
                            <div className="flex gap-3">
                                {seeds.map(s => {
                                    const url = `https://api.dicebear.com/9.x/avataaars/svg?seed=${s}&backgroundColor=e0e7ff`;
                                    return (
                                        <div key={s} onClick={() => setSelectedUrl(url)} className={`w-10 h-10 flex-shrink-0 rounded-full cursor-pointer transition-all duration-300 p-0.5 border-2 ${selectedUrl === url ? 'border-primary-500 scale-110' : 'border-transparent hover:scale-105 opacity-70 hover:opacity-100'}`}>
                                            <img src={url} className="rounded-full w-full h-full" />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex w-full gap-3 pt-4">
                    <Button variant="secondary" className="flex-1 rounded-xl py-3" onClick={onCancel}>Cancel</Button>
                    <Button className="flex-1 rounded-xl py-3 shadow-glow" onClick={() => onSave({ avatarUrl: selectedUrl })} disabled={!selectedUrl}>Save Changes</Button>
                </div>
            </div>
        </div>
    );
};

const CommentsSheet = ({ confessionId, onClose }: { confessionId: string, onClose: () => void }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        const load = async () => {
            const u = await db.getCurrentUser();
            setCurrentUser(u);
            const c = await db.getComments(confessionId);
            setComments(c);
        };
        load();
    }, [confessionId]);

    const handleSend = async () => {
        if (!newComment.trim() || !currentUser) return;

        if (currentUser.isBanned) {
            alert("Your account is restricted. You cannot comment."); // Using alert as toast helper isn't passed here easily, or could improve later
            return;
        }

        setLoading(true);
        await db.addComment(confessionId, currentUser.id, currentUser.username || 'User', newComment);
        setNewComment('');
        const c = await db.getComments(confessionId);
        setComments(c);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-end md:items-center" onClick={onClose}>
            <div className="bg-white w-full md:max-w-md h-[85vh] md:h-[650px] md:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden animate-slide-up shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur z-10 sticky top-0">
                    <h3 className="font-bold text-lg text-slate-800">Discussion</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><i className="fas fa-times text-slate-500 text-sm"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/50">
                    {comments.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <i className="far fa-comments text-5xl mb-3"></i>
                            <p className="font-medium">Be the first to reply!</p>
                        </div>
                    ) : comments.map(c => (
                        <div key={c.id} className="flex gap-3 animate-slide-up">
                            <div className="w-9 h-9 rounded-xl bg-orange-100 flex-shrink-0 flex items-center justify-center font-bold text-orange-600 text-sm shadow-sm">
                                {c.username[0].toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="font-bold text-sm text-slate-900">{c.username}</span>
                                        <span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed">{c.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-3 border-t border-slate-100 bg-white pb-safe">
                    <div className="flex gap-2 items-end bg-slate-50 p-1.5 rounded-3xl border border-slate-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
                        <input
                            className="flex-1 bg-transparent border-none px-4 py-2 outline-none text-sm placeholder-slate-400 min-h-[44px]"
                            placeholder="Add to the discussion..."
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            className="w-10 h-10 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-500/30 transition-all disabled:opacity-50 disabled:shadow-none transform active:scale-90"
                            disabled={!newComment.trim() || loading}
                            onClick={handleSend}
                        >
                            {loading ? <i className="fas fa-spinner fa-spin text-sm"></i> : <i className="fas fa-paper-plane text-sm translate-x-px translate-y-px"></i>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShareSheet = ({ confession, onClose }: { confession: Confession, onClose: () => void }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(`Check this out on UniConfess: "${confession.content.substring(0, 30)}..."`);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
            onClose();
        }, 1200);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-end md:items-center" onClick={onClose}>
            <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-3xl overflow-hidden animate-slide-up p-6 pb-safe shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 opacity-50"></div>
                <h3 className="font-extrabold text-xl mb-6 text-center text-slate-800">Share Post</h3>
                <div className="grid grid-cols-4 gap-2 mb-8">
                    <button className="flex flex-col items-center gap-2 group p-2 rounded-xl hover:bg-slate-50 transition-colors" onClick={handleCopy}>
                        <div className={`w-14 h-14 rounded-2xl ${copied ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'} flex items-center justify-center text-xl transition-colors duration-300`}>
                            {copied ? <i className="fas fa-check"></i> : <i className="fas fa-link"></i>}
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    {/* Placeholder buttons for visuals */}
                    {[{ icon: 'fab fa-whatsapp', color: 'bg-green-100 text-green-600', label: 'WhatsApp' }, { icon: 'fab fa-instagram', color: 'bg-pink-100 text-pink-600', label: 'Stories' }, { icon: 'far fa-envelope', color: 'bg-blue-100 text-blue-600', label: 'Email' }].map(item => (
                        <button key={item.label} className="flex flex-col items-center gap-2 group p-2 rounded-xl hover:bg-slate-50 transition-colors">
                            <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center text-xl shadow-sm`}>
                                <i className={item.icon}></i>
                            </div>
                            <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                        </button>
                    ))}
                </div>
                <Button variant="secondary" className="w-full py-3.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200" onClick={onClose}>Cancel</Button>
            </div>
        </div>
    );
};

interface PostViewProps {
    isModal?: boolean;
    onClose?: () => void;
    onPostSuccess?: (c: Confession) => void;
    user: User | null;
    adminCollegeId: string | null;
    setView: (view: AppView) => void;
    addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    defaultVisibility?: 'campus' | 'open';
}

interface ReportModalProps {
    onClose: () => void;
    onSubmit: (reason: string) => void;
}

const ReportModal = ({ onClose, onSubmit }: ReportModalProps) => {
    const [reason, setReason] = useState('');
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                    <i className="fas fa-flag"></i>
                </div>
                <h3 className="text-2xl font-black text-center text-slate-900 mb-2">Report Post</h3>
                <p className="text-center text-slate-500 text-sm mb-6 leading-relaxed">Help us keep the campus safe. Why are you reporting this?</p>

                <textarea
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-rose-100 outline-none resize-none h-32 mb-6 placeholder:text-slate-400 text-slate-800"
                    placeholder="e.g., Harassment, Hate speech, Spam..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    autoFocus
                />

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                    <button
                        onClick={() => { if (reason.trim()) onSubmit(reason); }}
                        disabled={!reason.trim()}
                        className="flex-1 py-3.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/30 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        Submit Report
                    </button>
                </div>
            </div>
        </div>
    );
};

const PostView = ({ isModal, onClose, onPostSuccess, user, adminCollegeId, setView, addToast, defaultVisibility = 'campus' }: PostViewProps) => {
    const [text, setText] = useState('');
    const [anon, setAnon] = useState(false);
    const [visibility, setVisibility] = useState<'campus' | 'open'>(defaultVisibility);
    const [polishing, setPolishing] = useState(false);
    const [posting, setPosting] = useState(false);

    const handlePolish = async () => {
        if (!text.trim()) return;
        setPolishing(true);
        try {
            const polished = await db.polishText(text);
            setText(polished);
            addToast('Text polished', 'success');
        } catch (err) {
            addToast('Polishing failed', 'error');
        } finally {
            setPolishing(false);
        }
    }

    const handlePost = async () => {
        if (!text.trim() || !user) return;

        if (user.isBanned) {
            addToast("Your account is restricted. You cannot create posts.", "error");
            setTimeout(() => {
                if (onClose) onClose();
                else setView(AppView.HOME);
            }, 500);
            return;
        }

        setPosting(true);
        try {
            const targetCollegeId = adminCollegeId || user.collegeId || 'general';
            const data = await db.createConfession(user.id, user.username || 'User', text, targetCollegeId, anon, user.avatarUrl, visibility);
            const newConfession = { ...data, timestamp: Number(data.timestamp), likes: [], __local: true };
            setText('');
            addToast("Confession posted successfully!", "success");
            if (onPostSuccess) onPostSuccess(newConfession);

            // Wait a tick to ensure toast renders and state stabilizes before navigating
            setTimeout(() => {
                if (onClose) onClose();
                else setView(AppView.HOME);
            }, 100);
        } catch (e) {
            addToast("Failed to post. Please try again.", "error");
        } finally {
            if (isModal) setPosting(false); // Only unset if modal, otherwise component unmounts
        }
    }

    return (
        <div className={`${isModal ? 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm' : 'min-h-screen bg-white flex flex-col'} z-50`}>
            <div className={`flex flex-col animate-slide-up bg-white ${isModal ? 'w-full max-w-xl min-h-[500px] rounded-3xl shadow-2xl overflow-hidden' : 'flex-1 w-full max-w-2xl mx-auto'}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <button onClick={() => isModal ? onClose?.() : setView(AppView.HOME)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <i className="fas fa-times"></i>
                    </button>
                    <h3 className="font-bold text-slate-900">New Confession</h3>
                    <div className="w-8"></div>
                </div>

                <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                    <div className="flex gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100 ${anon ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>
                            {anon ? <i className="fas fa-mask"></i> : <img src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.username || 'User'}`} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1">
                            <textarea
                                className="w-full min-h-[300px] bg-transparent text-xl text-slate-900 placeholder:text-slate-400 outline-none resize-none font-medium leading-relaxed"
                                placeholder="What's happening?"
                                value={text}
                                onChange={e => setText(e.target.value)}
                                autoFocus
                                maxLength={1500}
                            />
                            <div className={`text-right text-[10px] font-bold mt-2 ${text.length >= 1500 ? 'text-rose-500' : 'text-slate-400'}`}>
                                {text.length}/1500
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col gap-4 bg-white pb-6 sticky bottom-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <button onClick={() => setAnon(!anon)} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${anon ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                {anon ? <><i className="fas fa-user-secret"></i> <span>Anonymous</span></> : <><i className="fas fa-globe"></i> <span>Public</span></>}
                            </button>

                            <div className="flex bg-slate-100 p-1 rounded-full shrink-0">
                                <button
                                    onClick={() => setVisibility('campus')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${visibility === 'campus' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    My Campus
                                </button>
                                <button
                                    onClick={() => setVisibility('open')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${visibility === 'open' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Global
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <button onClick={handlePolish} disabled={!text.trim() || polishing} className="text-primary-600 flex items-center gap-2 font-bold text-sm hover:opacity-75 transition-opacity disabled:opacity-30">
                                <i className={`fas fa-magic ${polishing ? 'animate-pulse' : ''}`}></i>
                                {polishing ? 'Magic...' : 'Polish Text'}
                            </button>
                            <button onClick={handlePost} disabled={!text.trim() || posting} className="bg-primary-600 text-white px-8 py-2.5 rounded-full font-black text-sm shadow-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                                {posting ? 'Posting...' : 'Post Confession'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {!isModal && <p className="px-6 py-8 text-slate-400 text-[10px] font-black text-center tracking-[0.2em] uppercase opacity-50">UniConfess Safe Space</p>}
        </div>
    );
};

interface SearchViewProps {
    user: User | null;
    setSelectedUser: (u: User) => void;
    navigateTo: (v: AppView) => void;
}

const SearchView = ({ user, setSelectedUser, navigateTo }: SearchViewProps) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<User[]>([]);

    useEffect(() => {
        if (!query.trim()) { setResults([]); return; }
        const timer = setTimeout(async () => {
            const users = await db.getAllUsers();
            const lowerQ = query.toLowerCase();
            // REVERT: Allow global search as requested
            const filtered = users.filter(u => u.id !== user?.id && (u.username?.toLowerCase().includes(lowerQ) || u.displayName?.toLowerCase().includes(lowerQ)));
            setResults(filtered);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, user]);

    return (
        <div className="animate-fade-in min-h-screen">
            <div className="sticky top-0 bg-white/90 backdrop-blur-md z-30 border-b border-slate-100 px-4 py-3">
                <div className="relative group">
                    <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors"></i>
                    <input
                        type="text"
                        className="w-full h-11 pl-12 pr-4 bg-slate-100 rounded-full outline-none text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-primary-500/20 transition-all placeholder:text-slate-500"
                        placeholder="Search for people"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="p-4 space-y-2">
                {query && results.length === 0 && (
                    <div className="py-20 text-center text-slate-400">
                        <p className="font-bold text-slate-900 mb-1">No results for "{query}"</p>
                        <p className="text-sm">Try searching for someone else.</p>
                    </div>
                )}
                {results.map(u => (
                    <div key={u.id} onClick={() => { setSelectedUser(u); navigateTo(AppView.USER_PROFILE); }} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-100 bg-slate-100">
                            <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${u.username || 'User'}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 truncate">{u.displayName || u.username}</p>
                            <p className="text-slate-500 text-sm truncate">@{u.username}</p>
                        </div>
                    </div>
                ))}
                {!query && (
                    <div className="py-10 text-center">
                        <p className="text-slate-500 text-sm font-medium">Try searching for people, topics, or keywords</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface MessagesViewProps {
    user: User | null;
    setSelectedUser: (u: User) => void;
    navigateTo: (v: AppView) => void;
    confirmAction: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'info') => void;
}

const MessagesView = ({ user, setSelectedUser, navigateTo, confirmAction }: MessagesViewProps) => {
    const [inbox, setInbox] = useState<{ requests: string[], accepted: string[] }>({ requests: [], accepted: [] });
    const [profiles, setProfiles] = useState<Record<string, User>>({});
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [tab, setTab] = useState<'primary' | 'requests'>('primary');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const fetchInbox = async () => {
            const res = await db.getInbox(user.id);
            setInbox(res);
            const counts = await db.getUnreadCountsPerPeer(user.id);
            setUnreadCounts(counts);
            const ids = Array.from(new Set([...res.accepted, ...res.requests]));
            const profs: Record<string, User> = {};
            for (const id of ids) { const u = await db.getUser(id); if (u) profs[id] = u; }
            setProfiles(profs);
        };
        fetchInbox();
        const interval = setInterval(fetchInbox, 5000);
        return () => clearInterval(interval);
    }, [user]);

    const activeList = tab === 'primary' ? inbox.accepted : inbox.requests;

    const handleDeleteChat = (id: string, name: string) => {
        confirmAction(
            "Delete Conversation?",
            `Delete chat with ${name}? This will remove it from your inbox.`,
            async () => {
                await db.rejectChat(user!.id, id);
                setInbox(prev => ({
                    ...prev,
                    accepted: prev.accepted.filter(aid => aid !== id),
                    requests: prev.requests.filter(rid => rid !== id)
                }));
                setMenuOpenId(null);
            },
            'danger'
        );
    };

    return (
        <div className="animate-fade-in min-h-screen pb-safe" onClick={() => setMenuOpenId(null)}>
            <div className="sticky top-0 bg-white/90 backdrop-blur-md z-30 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                <h2 className="font-black text-xl text-slate-900">Messages</h2>
                <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
                    <i className="fas fa-cog"></i>
                </button>
            </div>

            <div className="flex border-b border-slate-100">
                <button onClick={() => setTab('primary')} className={`flex-1 py-4 text-sm font-bold transition-all relative ${tab === 'primary' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    Primary
                    {tab === 'primary' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-orange-600 rounded-full"></div>}
                </button>
                <button onClick={() => setTab('requests')} className={`flex-1 py-4 text-sm font-bold transition-all relative ${tab === 'requests' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    Requests {inbox.requests.length > 0 && <span className="ml-1 bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{inbox.requests.length}</span>}
                    {tab === 'requests' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-orange-600 rounded-full"></div>}
                </button>
            </div>

            <div className="divide-y divide-slate-50">
                {activeList.length === 0 ? (
                    <div className="py-20 text-center p-6">
                        <h3 className="font-extrabold text-2xl text-slate-900 mb-2">Welcome to your inbox!</h3>
                        <p className="text-slate-500 leading-relaxed mb-6">Drop a line, share posts and more with private conversations between you and others on UniConfess.</p>
                        <button className="px-6 py-3 rounded-full bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20" onClick={() => navigateTo(AppView.SEARCH)}>
                            Write a message
                        </button>
                    </div>
                ) : (
                    activeList.map(id => profiles[id] && (
                        <div key={id} className="group relative">
                            <div onClick={() => { setSelectedUser(profiles[id]); navigateTo(AppView.CHAT_DETAIL); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors pr-12">
                                <div className="relative">
                                    <img src={profiles[id].avatarUrl || `https://ui-avatars.com/api/?name=${profiles[id].username || 'User'}`} className="w-12 h-12 rounded-full object-cover bg-slate-100 border border-slate-100" />
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <h3 className={`font-bold ${unreadCounts[id] > 0 ? 'text-slate-900' : 'text-slate-700'}`}>{profiles[id].displayName || profiles[id].username}</h3>
                                        {unreadCounts[id] > 0 && (
                                            <span className="bg-primary-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-primary-600/20 animate-fade-in whitespace-nowrap">
                                                {unreadCounts[id]} new
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 truncate">@{profiles[id].username}</p>
                                </div>
                            </div>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpenId(menuOpenId === id ? null : id);
                                    }}
                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                                >
                                    <i className="fas fa-ellipsis-v text-sm"></i>
                                </button>
                                {menuOpenId === id && (
                                    <div className="absolute right-0 top-12 bg-white shadow-premium rounded-2xl border border-slate-100 w-44 py-2 z-50 overflow-hidden animate-slide-up origin-top-right ring-1 ring-black/5">
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 font-bold transition-colors flex items-center gap-3"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteChat(id, profiles[id].displayName || profiles[id].username);
                                            }}
                                        >
                                            <i className="far fa-trash-alt"></i> Delete Conversation
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

interface ChatDetailViewProps {
    user: User | null;
    selectedUser: User | null;
    goBack: () => void;
    onMessagesRead?: () => void;
    confirmAction: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'info') => void;
}

const ChatDetailView = ({ user, selectedUser, goBack, onMessagesRead, confirmAction }: ChatDetailViewProps) => {
    const [msgText, setMsgText] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [isRequest, setIsRequest] = useState(false);
    const [isBlocked, setIsBlocked] = useState(user?.blockedUsers?.includes(selectedUser?.id || '') || false);

    useEffect(() => {
        if (!user || !selectedUser) return;
        setIsBlocked(user.blockedUsers?.includes(selectedUser.id) || false);

        const fetchMsgs = async () => {
            const msgs = await db.getMessages(user.id, selectedUser.id);
            setMessages(msgs);
            await db.markAsRead(user.id, selectedUser.id);
            if (onMessagesRead) onMessagesRead();
            const inbox = await db.getInbox(user.id);
            setIsRequest(inbox.requests.includes(selectedUser.id));
        };

        fetchMsgs();

        // Subscribe to NEW incoming messages for THIS conversation
        const sub = db.subscribeToMessages(user.id, (newMsg) => {
            if (newMsg.senderId === selectedUser.id) {
                setMessages(prev => {
                    // Avoid duplicates if polling/set interval was still running or if manually sent
                    if (prev.find(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
                db.markAsRead(user.id, selectedUser.id);
                if (onMessagesRead) onMessagesRead();
            }
        });

        // Fallback polling (slower, for reliability)
        const interval = setInterval(fetchMsgs, 10000);

        return () => {
            sub.unsubscribe();
            clearInterval(interval);
        };
    }, [user?.id, selectedUser?.id, user?.blockedUsers]);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = async () => {
        if (!msgText.trim() || !user || !selectedUser || isBlocked) return;
        const txt = msgText; setMsgText('');
        // Optimistic update
        setMessages(prev => [...prev, { id: 'temp-' + Date.now(), senderId: user.id, receiverId: selectedUser.id, content: txt, timestamp: Date.now(), read: false }]);
        try {
            await db.sendMessage(user.id, selectedUser.id, txt);
        } catch (e: any) {
            alert(e.message || "Failed to send message");
            // Sync messages to remove optimistic fail
            const msgs = await db.getMessages(user.id, selectedUser.id);
            setMessages(msgs);
        }
    };

    const handleBlock = async () => {
        if (!user || !selectedUser) return;
        if (isBlocked) {
            await db.unblockUser(user.id, selectedUser.id);
            setIsBlocked(false);
        } else {
            confirmAction(
                "Block User?",
                `Block ${selectedUser.displayName || selectedUser.username}? You won't see messages from each other.`,
                async () => {
                    await db.blockUser(user.id, selectedUser.id);
                    setIsBlocked(true);
                },
                'danger'
            );
        }
    };

    if (!selectedUser) return null;

    return (
        <div className="flex flex-col h-screen bg-white fixed inset-0 z-50 lg:relative lg:inset-auto">
            <div className="px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center gap-4 pt-safe z-20">
                <button onClick={goBack} className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors"><i className="fas fa-arrow-left text-slate-800"></i></button>
                <div className="flex-1 flex flex-col min-w-0">
                    <span className="font-bold text-slate-900 leading-tight truncate">{selectedUser.displayName || selectedUser.username}</span>
                    <span className="text-[10px] text-slate-500 truncate">@{selectedUser.username}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleBlock} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isBlocked ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {isBlocked ? 'Unblock' : 'Block'}
                    </button>
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 bg-slate-100 flex-shrink-0">
                        <img src={selectedUser.avatarUrl || `https://ui-avatars.com/api/?name=${selectedUser.username || 'User'}`} className="w-full h-full object-cover" />
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 bg-white">
                {isBlocked && (
                    <div className="bg-rose-50 text-rose-600 p-6 rounded-3xl text-center text-sm font-bold mb-4 animate-fade-in border border-rose-100">
                        <i className="fas fa-ban mb-2 text-xl block"></i>
                        You have blocked this user.
                    </div>
                )}
                {isRequest && !isBlocked && (
                    <div className="border border-slate-100 p-6 rounded-2xl text-center mb-6 mx-4 bg-slate-50/30">
                        <p className="font-bold text-slate-900 mb-1">Message Request</p>
                        <p className="text-slate-500 text-sm mb-4">Accept to start chatting.</p>
                        <div className="flex justify-center gap-3">
                            <Button variant="danger" className="py-2 px-6 rounded-full text-sm" onClick={async () => { await db.rejectChat(user!.id, selectedUser.id); goBack(); }}>Delete</Button>
                            <Button className="py-2 px-6 rounded-full text-sm" onClick={async () => { await db.acceptChat(user!.id, selectedUser.id); setIsRequest(false); }}>Accept</Button>
                        </div>
                    </div>
                )}
                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.senderId === user?.id ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-[14px] shadow-sm leading-relaxed ${m.senderId === user?.id ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef}></div>
            </div>
            {!isRequest && !isBlocked && (
                <div className="p-3 bg-white border-t border-slate-100 pb-safe fixed bottom-0 left-0 right-0 z-20 md:absolute">
                    <div className="flex gap-2 items-center bg-slate-100 p-1.5 rounded-full px-4 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/20 transition-all border border-transparent focus-within:border-primary-500">
                        <input className="flex-1 bg-transparent border-none py-1.5 outline-none text-sm placeholder:text-slate-500 text-slate-900" placeholder="Start a message..." value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
                        <button onClick={handleSend} disabled={!msgText.trim()} className="w-8 h-8 text-primary-600 rounded-full flex items-center justify-center hover:bg-primary-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"><i className="fas fa-paper-plane text-sm"></i></button>
                    </div>
                </div>
            )}
        </div>
    );
};


interface ProfileViewProps {
    user: User;
    setView: (v: AppView) => void;
    setUser: (u: User | null) => void;
    navigateTo: (v: AppView) => void;
    confessions: Confession[];
    colleges: College[];
    onDelete: (confession: Confession) => void;
    onLike: (id: string, undo?: boolean) => void;
    onAccountDelete: () => Promise<void>;
    onUpdateProfile: (updates: Partial<User>) => Promise<void>;
    confirmAction: (title: string, msg: string, onConfirm: () => void, type?: 'danger' | 'info') => void;
}

const ProfileView = ({ user, setView, setUser, navigateTo, confessions, colleges, onDelete, onLike, onAccountDelete, onUpdateProfile, confirmAction }: ProfileViewProps) => {
    const [userPosts, setUserPosts] = useState<Confession[]>([]);
    const [tab, setTab] = useState<'Posts' | 'Replies' | 'Likes'>('Posts');
    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState<'manage' | 'avatar' | null>(null);

    const collegeName = colleges.find(c => c.id === user.collegeId)?.name || 'Campus Student';

    useEffect(() => {
        const fetch = async () => {
            const data = await db.getConfessionsByUser(user.id);
            setUserPosts(data);
        };
        fetch();
    }, [user.id]);

    return (
        <div className="px-4 lg:px-0 animate-fade-in pb-32">
            <div className="bg-white rounded-3xl shadow-soft overflow-hidden mb-6 border border-white relative group">
                <div className="h-32 bg-gradient-to-r from-primary-500 to-amber-500"></div>
                <div className="px-6 relative pb-6">
                    <div className="absolute -top-12 left-6 w-24 h-24 rounded-2xl border-4 border-white bg-white overflow-hidden shadow-md group-hover:scale-105 transition-transform origin-bottom-left cursor-pointer">
                        <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.username || 'User'}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-end pt-4 gap-2">
                        {(user.isAdmin || user.email === 'admin@yug.com') && (
                            <Button className="py-2 px-4 text-xs rounded-xl bg-slate-800 text-white shadow-lg shadow-slate-900/20" onClick={() => navigateTo(AppView.ADMIN)}>
                                <i className="fas fa-shield-alt mr-2"></i>Admin
                            </Button>
                        )}
                        <button
                            className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 shadow-sm border border-slate-100 transition-all hover:rotate-12"
                            onClick={() => setShowSettings(true)}
                        >
                            <i className="fas fa-cog text-lg"></i>
                        </button>
                    </div>
                    <div className="mt-4">
                        <h2 className="font-black text-2xl text-slate-900 flex items-center gap-2">
                            {user.displayName || user.username}
                            {user.isAdmin && <i className="fas fa-badge-check text-primary-500 text-sm" title="Admin"></i>}
                        </h2>
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <span>@{user.username}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="text-primary-600 font-bold text-xs uppercase tracking-wider">{collegeName}</span>
                        </div>
                        <p className="mt-3 text-slate-700 leading-relaxed text-sm max-w-lg">{user.bio || 'Living the campus life, one coffee at a time. ☕'}</p>

                        {user.isBanned && (
                            <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-3">
                                <i className="fas fa-ban text-lg"></i>
                                <div>
                                    <p className="font-bold text-sm">Account Restricted</p>
                                    <p className="text-xs opacity-80">You cannot create posts or comments.</p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-6 mt-4 pt-4 border-t border-slate-50">
                            <div className="text-center cursor-pointer hover:opacity-75 transition-opacity">
                                <span className="block font-black text-slate-900 text-lg">{(user.following || []).length}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Following</span>
                            </div>
                            <div className="text-center cursor-pointer hover:opacity-75 transition-opacity">
                                <span className="block font-black text-slate-900 text-lg">{(user.followers || []).length}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Followers</span>
                            </div>
                            <div className="text-center cursor-pointer hover:opacity-75 transition-opacity">
                                <span className="block font-black text-slate-900 text-lg">{userPosts.length}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Posts</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings & Account Management Sheets */}
            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
                    {settingsView === null && (
                        <SettingsView
                            user={user}
                            onClose={() => setShowSettings(false)}
                            setSubView={setSettingsView}
                            onLogout={async () => {
                                await db.logout();
                                window.location.reload();
                            }}
                            confirmAction={confirmAction}
                        />
                    )}
                    {settingsView === 'avatar' && (
                        <EditProfileView
                            user={user}
                            onSave={async (updates) => {
                                await onUpdateProfile(updates);
                                setSettingsView(null);
                            }}
                            onCancel={() => setSettingsView(null)}
                        />
                    )}
                    {settingsView === 'manage' && (
                        <ManageAccountView
                            user={user}
                            onSave={async (updates) => {
                                await onUpdateProfile(updates);
                                setSettingsView(null);
                            }}
                            onDelete={onAccountDelete}
                            onCancel={() => setSettingsView(null)}
                            confirmAction={confirmAction}
                        />
                    )}
                </div>
            )}


            <div className="space-y-4">
                {userPosts.length === 0 ? (
                    <div className="text-center p-12 bg-white rounded-[2rem] border border-slate-100 border-dashed">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 text-2xl">
                            <i className="far fa-newspaper"></i>
                        </div>
                        <p className="text-slate-900 font-bold">No posts yet</p>
                        <p className="text-slate-400 text-sm mt-1">When you share a confession, it will appear here.</p>
                    </div>
                ) : (
                    userPosts.map(c => (
                        <div key={c.id}>
                            <ConfessionItem
                                confession={c}
                                currentUser={user}
                                onDelete={onDelete}
                                onLike={onLike}
                                onReply={() => { }}
                                onShare={() => { }}
                                onProfileClick={() => { }}
                                onReport={() => { }}
                                hideSocials={true}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

interface UserProfileViewProps {
    selectedUser: User;
    currentUser: User | null;
    setSelectedUser: (u: User | null) => void;
    navigateTo: (v: AppView) => void;
    addToast: (msg: string, type?: 'success' | 'error') => void;
    confessions: Confession[];
    colleges: College[];
    onFollow: (id: string) => void;
}

const UserProfileView = ({ selectedUser, currentUser, setSelectedUser, navigateTo, addToast, confessions: _, colleges, onFollow }: UserProfileViewProps) => {
    const [userPosts, setUserPosts] = useState<Confession[]>([]);
    const isFollowing = currentUser?.following?.includes(selectedUser.id);
    const isMe = currentUser?.id === selectedUser.id;
    const collegeName = colleges.find(c => c.id === selectedUser.collegeId)?.name || 'Campus Student';

    useEffect(() => {
        const fetch = async () => {
            const data = await db.getConfessionsByUser(selectedUser.id);
            setUserPosts(data);
        };
        fetch();
    }, [selectedUser.id]);

    return (
        <div className="px-4 lg:px-0 animate-fade-in pb-32">
            <div className="bg-white rounded-3xl shadow-soft overflow-hidden mb-6 border border-white">
                <div className="h-32 bg-slate-200"></div>
                <div className="px-6 relative pb-6">
                    <div className="absolute -top-12 left-6 w-24 h-24 rounded-2xl border-4 border-white bg-white overflow-hidden shadow-md">
                        <img src={selectedUser.avatarUrl || `https://ui-avatars.com/api/?name=${selectedUser.username || 'User'}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-end pt-4 gap-3">
                        <button className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors" onClick={() => { setSelectedUser(selectedUser); navigateTo(AppView.CHAT_DETAIL); }}>
                            <i className="fas fa-envelope"></i>
                        </button>
                        {!isMe && (
                            <Button
                                className={`py-2 px-6 rounded-xl shadow-glow font-bold transition-all ${isFollowing
                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-none'
                                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                                    }`}
                                onClick={() => onFollow(selectedUser.id)}
                            >
                                {isFollowing ? 'Unfollow' : 'Follow'}
                            </Button>
                        )}
                    </div>
                    <div className="mt-4">
                        <h2 className="font-black text-2xl text-slate-900">{selectedUser.displayName || selectedUser.username}</h2>
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <span>@{selectedUser.username}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="text-primary-600 font-bold text-xs uppercase tracking-wider">{collegeName}</span>
                        </div>
                        <p className="mt-3 text-slate-700 leading-relaxed text-sm">{selectedUser.bio || 'Student.'}</p>
                        <div className="flex gap-6 mt-4 pt-4 border-t border-slate-50">
                            <div className="text-center">
                                <span className="block font-black text-slate-900 text-lg">{selectedUser.following?.length || 0}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Following</span>
                            </div>
                            <div className="text-center">
                                <span className="block font-black text-slate-900 text-lg">{selectedUser.followers?.length || 0}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Followers</span>
                            </div>
                            <div className="text-center">
                                <span className="block font-black text-slate-900 text-lg">{userPosts.length}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Posts</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <h3 className="font-bold text-slate-900 mb-4 px-2 text-lg">Posts</h3>
            <div className="space-y-4">
                {userPosts.length === 0 ? (
                    <div className="text-center p-12 bg-white rounded-[2rem] border border-slate-100 border-dashed">
                        <p className="text-slate-400 font-medium">@{selectedUser.username} hasn't posted anything yet.</p>
                    </div>
                ) : (
                    userPosts.map(c => (
                        <div key={c.id}>
                            <ConfessionItem
                                confession={c}
                                currentUser={null}
                                onDelete={() => { }}
                                onLike={() => { }}
                                onReply={() => { }}
                                onShare={() => { }}
                                onProfileClick={() => { }}
                                onReport={() => { }}
                                hideSocials={true}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

interface LayoutProps {
    children: React.ReactNode;
    user: User | null;
    view: AppView;
    setView: (v: AppView) => void;
    unreadMsgCount: number;
    adminCollegeId: string | null;
    addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    onPostSuccess: (c: Confession) => void;
}


const Layout = ({ children, user, view, setView, unreadMsgCount, adminCollegeId, addToast, onPostSuccess }: LayoutProps) => {
    const { signOut } = useClerk();
    const [showPostModal, setShowPostModal] = useState(false);
    if (!user) return <>{children}</>;

    return (
        <div className="min-h-screen bg-slate-50 flex justify-center text-slate-900">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-[280px] social-sidebar px-6 py-8 fixed left-[max(16px,calc(50%-440px))]">
                <div className="mb-10 flex items-center gap-4 px-2">
                    <div className="w-10 h-10 drop-shadow-md">
                        <AppLogo className="w-full h-full" />
                    </div>
                    <h1 className="font-extrabold text-xl tracking-tight text-slate-900">UniConfess</h1>
                </div>
                <nav className="space-y-2 flex-1">
                    <NavIcon active={view === AppView.HOME} icon={<i className="fas fa-home"></i>} label="Home Feed" onClick={() => setView(AppView.HOME)} />
                    <NavIcon active={view === AppView.SEARCH} icon={<i className="fas fa-search"></i>} label="Discover" onClick={() => setView(AppView.SEARCH)} />
                    <NavIcon active={view === AppView.MESSAGES} icon={<i className="far fa-comment-dots"></i>} label="Messages" onClick={() => setView(AppView.MESSAGES)} badge={unreadMsgCount} />
                    <NavIcon active={view === AppView.PROFILE} icon={<i className="far fa-user"></i>} label="My Profile" onClick={() => setView(AppView.PROFILE)} />
                </nav>

                <div className="mt-6">
                    <button
                        onClick={() => setShowPostModal(true)}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary-600/20 active:scale-95 group"
                    >
                        <i className="fas fa-plus bg-white/20 w-8 h-8 rounded-lg flex items-center justify-center text-sm group-hover:rotate-90 transition-transform"></i>
                        <span className="tracking-tight text-lg">Post Confession</span>
                    </button>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-4 px-2 opacity-50">Share your thoughts anonymously</p>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 cursor-pointer transition-colors group" onClick={() => signOut().then(() => { setView(AppView.AUTH); })}>
                        <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.username || 'User'}`} className="w-10 h-10 rounded-xl object-cover bg-slate-100" />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{user.displayName || user.username}</p>
                            <p className="text-slate-400 text-xs truncate">Log out</p>
                        </div>
                        <i className="fas fa-sign-out-alt text-slate-300 group-hover:text-rose-500 transition-colors"></i>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="w-full lg:w-[600px] lg:ml-[280px] min-h-screen relative border-r border-slate-100 bg-white">
                {children}
            </main>

            {/* Mobile Bottom Navbar */}
            <nav className="lg:hidden fixed bottom-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center px-6 py-3 pb-safe z-40 shadow-premium">
                <button onClick={() => setView(AppView.HOME)} className={`text-xl p-2 transition-all ${view === AppView.HOME ? 'text-primary-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}><i className="fas fa-home"></i></button>
                <button onClick={() => setView(AppView.SEARCH)} className={`text-xl p-2 transition-all ${view === AppView.SEARCH ? 'text-primary-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}><i className="fas fa-search"></i></button>
                <button onClick={() => setShowPostModal(true)} className="w-12 h-12 bg-primary-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/20 active:scale-95"><i className="fas fa-plus"></i></button>
                <button onClick={() => setView(AppView.MESSAGES)} className={`text-xl p-2 transition-all relative ${view === AppView.MESSAGES ? 'text-primary-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
                    <i className="far fa-comment-alt"></i>
                    {unreadMsgCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center px-1 animate-fade-in shadow-sm">
                            {unreadMsgCount}
                        </span>
                    )}
                </button>
                <button onClick={() => setView(AppView.PROFILE)} className={`text-xl p-2 transition-all ${view === AppView.PROFILE ? 'text-primary-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}><i className="far fa-user"></i></button>
            </nav>

            {showPostModal && <PostView isModal onClose={() => setShowPostModal(false)} onPostSuccess={(c) => { onPostSuccess(c); setShowPostModal(false); }} user={user} adminCollegeId={adminCollegeId} setView={setView} addToast={addToast} />}
        </div>
    );
};

export default function App() {
    // const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser(); // Removed
    const { signOut } = useClerk(); // We still use this to logout from Clerk if they were verified

    const [user, setUser] = useState<User | null>(null);
    const [view, setView] = useState<AppView>(AppView.AUTH);
    const [history, setHistory] = useState<AppView[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showSplash, setShowSplash] = useState(true);
    const [loading, setLoading] = useState(true); // Added

    const [colleges, setColleges] = useState<College[]>([]);
    const [confessions, setConfessions] = useState<Confession[]>([]);

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [feedTab, setFeedTab] = useState<'campus' | 'open'>('campus');
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [unreadMsgCount, setUnreadMsgCount] = useState(0);
    const [activeCommentConfessionId, setActiveCommentConfessionId] = useState<string | null>(null);
    const [activeShareConfession, setActiveShareConfession] = useState<Confession | null>(null);

    // Reporting
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportingConfessionId, setReportingConfessionId] = useState<string | null>(null);

    // Admin & filtering
    const [confessionSearch, setConfessionSearch] = useState('');
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allConf, setAllConf] = useState<Confession[]>([]);
    const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'content'>('overview');
    const [adminCollegeId, setAdminCollegeId] = useState<string | null>(null); // For admin to switch context

    // Username validation logic
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [debouncedUsername, setDebouncedUsername] = useState('');

    useEffect(() => {
        if (!debouncedUsername || debouncedUsername.length < 3) {
            setUsernameStatus('idle');
            return;
        }

        const check = async () => {
            setUsernameStatus('checking');
            const isAvailable = await db.isUsernameAvailable(debouncedUsername);
            setUsernameStatus(isAvailable ? 'available' : 'taken');
        };

        const timer = setTimeout(check, 500);
        return () => clearTimeout(timer);
    }, [debouncedUsername]);

    // Navigation Logic
    // We synchronize our internal 'history' stack with the browser/mobile back button

    const [confirmState, setConfirmState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'danger' | 'info' }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger'
    });

    const confirmAction = useCallback((title: string, message: string, onConfirm: () => void, type: 'danger' | 'info' = 'danger') => {
        setConfirmState({ isOpen: true, title, message, onConfirm, type });
    }, []);

    // 1. Handle Browser "Back" Event (popstate)
    // 1. Handle Browser "Back" Event (popstate)
    const historyRef = useRef<AppView[]>(history);
    const viewRef = useRef<AppView>(view);

    useEffect(() => { historyRef.current = history; }, [history]);
    useEffect(() => { viewRef.current = view; }, [view]);

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            const currentHistory = historyRef.current;
            if (currentHistory.length > 0) {
                const prevView = currentHistory[currentHistory.length - 1];
                setHistory(h => h.slice(0, -1));
                setView(prevView);
            } else {
                // If history is empty but we are deeper in the app (e.g. direct load), go Home
                const currentView = viewRef.current;
                if (currentView !== AppView.HOME && currentView !== AppView.AUTH) {
                    setView(AppView.HOME);
                }
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigateTo = useCallback((newView: AppView) => {
        setHistory(h => [...h, view]);
        // Push state to browser history so the back button works physically
        window.history.pushState({ view: newView }, '', '');
        setView(newView);
    }, [view]);

    const goBack = useCallback(() => {
        // Trigger system back to ensure 'popstate' fires and keeps sync
        if (history.length > 0) {
            window.history.back();
        } else {
            // Fallback: If no history stack, force Home
            if (view !== AppView.HOME) setView(AppView.HOME);
        }
    }, [history, view]);

    // Re-bind popstate properly to access state
    useEffect(() => {
        const onPopState = (e: PopStateEvent) => {
            // The system already popped the state.
            // We just need to sync our UI.
            goBack(true);
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [history, view]); // Re-bind when history changes so 'goBack' sees correct state

    const handleManualRefresh = async () => {
        setRefreshing(true);
        // Simulate refresh delay for UX
        await new Promise(r => setTimeout(r, 1000));
        // The realtime subscription should already be active, but we can force re-fetch if we had a method exposed.
        const c = await db.getColleges();
        setColleges(c);
        setRefreshing(false);
    };

    const { refreshing: isPullRefreshing, pullChange } = usePullToRefresh(handleManualRefresh);

    useEffect(() => {
        const splashTimer = setTimeout(() => setShowSplash(false), 2000);

        // Load initial data
        const loadInit = async () => {
            const c = await db.getColleges();
            setColleges(c);
        };
        loadInit();

        // Firebase Auth Listener
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Get DB user
                    let appUser = await db.getUser(firebaseUser.uid);

                    if (!appUser) {
                        // Fallback heal (simulated, usually handled in service or auth flow)
                        // But here we just wait for the db to be consistent if created elsewhere
                        // Or we can rely on db.getUser returning null for new users until setup
                    }

                    if (appUser) {
                        setUser(appUser);
                        db.requestNotificationPermission(appUser.id);

                        // Navigation
                        if (!appUser.username) setView(AppView.SETUP_USERNAME);
                        else if (!appUser.collegeId && !appUser.isAdmin) setView(AppView.SETUP_COLLEGE);
                        else if (view === AppView.AUTH) setView(AppView.HOME);
                    } else {
                        // User authenticated in Firebase but no DB record yet? 
                        // This might happen during the split second of registration. 
                        // We'll let the registration flow handle the setUser/setView.
                        // Or we can try to "heal" here.
                        // For now, let's assume registration flow sets user.
                    }
                } catch (e) {
                    console.error("Sync failed", e);
                }
            } else {
                setUser(null);
                setView(AppView.AUTH);
            }
            setLoading(false);
        });

        return () => {
            clearTimeout(splashTimer);
            unsubscribe();
        }
    }, []); // Run once on mount

    const refreshUnreadCount = useCallback(async () => {
        if (!user) return;
        const msgCount = await db.getUnreadCount(user.id);
        setUnreadMsgCount(msgCount);
        const notifCount = await db.getUnreadNotificationCount(user.id);
        setUnreadNotifCount(notifCount);
    }, [user?.id]);

    // Real-time subscription for Feed
    useEffect(() => {
        let unsubscribe: any;
        if (user || adminCollegeId) {
            const targetCollegeId = adminCollegeId || user?.collegeId;

            if (!targetCollegeId && feedTab === 'campus') {
                setConfessions([]); // Clear if no college
                return;
            }

            // Clear old confessions when switching to avoid bleed
            setConfessions([]);

            console.log(`Subscribing to ${feedTab} feed (${targetCollegeId})...`);
            unsubscribe = db.subscribeToConfessions(targetCollegeId || 'global', feedTab, (data) => {
                console.log("Received data:", data.length);
                setConfessions(prev => {
                    const locals = prev.filter(c => (c as any).__local);
                    const dbIds = new Set(data.map(c => c.id));
                    const pendingLocals = locals.filter(c => !dbIds.has(c.id));
                    return [...pendingLocals, ...data];
                });
            });
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user?.id, user?.collegeId, adminCollegeId, feedTab]); // More granular dependency to catch collegeId updates

    // Admin data load (still fetch once for simplicity)
    useEffect(() => {
        if (view === AppView.ADMIN) {
            const loadAdminData = async () => {
                const u = await db.getAllUsers();
                const c = await db.getAllConfessions();
                setAllUsers(u);
                setAllConf(c);
            };
            loadAdminData();
        }
    }, [view]);

    useEffect(() => {
        if (!user) return;

        const sub = db.subscribeToNotifications(user.id, (n) => {
            setUnreadNotifCount(prev => prev + 1);

            // Play notification sound
            try {
                const isRealAdmin = n.type === 'system' && n.actorName !== 'New Confession';
                const soundFile = isRealAdmin ? '/admin-notification.mp3' : '/notification.mp3';
                const audio = new Audio(soundFile);
                audio.play().catch(e => console.log('Audio play failed (user interaction needed first):', e));
            } catch (e) {
                console.error('Error playing notification sound:', e);
            }

            // Show System Notification (Status Bar)
            if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
                try {
                    new window.Notification(n.actorName || 'UniConfess', {
                        body: n.content,
                        icon: '/logo.svg' // Ensure this exists or use default
                    });
                } catch (e) {
                    console.error('System notification failed:', e);
                }
            }

            if (n.type === 'system' && n.actorName !== 'New Confession') {
                addToast(`IMPORTANT: ${n.content}`, 'info');
            } else {
                addToast(n.content || 'New Notification', 'info');
            }
        });

        const subMsg = db.subscribeToMessages(user.id, async (m) => {
            const currentTotal = await db.getUnreadCount(user.id);
            setUnreadMsgCount(currentTotal);
            if (view !== AppView.CHAT_DETAIL) {
                addToast(`New message received (${currentTotal} unread)`, 'info');
            }
        });

        const poll = setInterval(refreshUnreadCount, 15000);

        return () => {
            sub.unsubscribe();
            subMsg.unsubscribe();
            clearInterval(poll);
        };
    }, [user?.id, view, refreshUnreadCount]);

    // Manually refresh (optional now with realtime, but good fallback)
    // Manually refresh
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const targetCollegeId = adminCollegeId || user?.collegeId;
            if (targetCollegeId) {
                const data = await db.getConfessionsByCollege(targetCollegeId);
                setConfessions(prev => {
                    // Keep locals? Usually refresh implies "get absolute truth from server"
                    // But to be safe for pending uploads, let's keep locals.
                    const locals = prev.filter(c => (c as any).__local);
                    const dbIds = new Set(data.map(c => c.id));
                    const pendingLocals = locals.filter(c => !dbIds.has(c.id));
                    return [...pendingLocals, ...data];
                });
            }
        } catch (e) {
            console.error("Refresh failed", e);
            addToast("Failed to refresh", "error");
        } finally {
            setRefreshing(false);
        }
    }

    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // --- Handlers ---
    const handlePostSuccess = (c: Confession) => {
        // 1. Optimistic update
        setConfessions(prev => [c, ...prev]);
        // 2. Trigger fetch (background refresh)
        handleRefresh();
    };

    const handleLikeConfession = useCallback(async (id: string) => { if (!user) return; await db.toggleLike(id, user.id); }, [user]);
    const handleDeleteConfession = useCallback((confession: Confession) => {
        if (!user) return;
        const isAdmin = user.isAdmin || user.id === 'admin_user' || user.email === 'admin@yug.com';
        const isOwner = user.id === confession.userId;

        if (!isAdmin && !isOwner) return;

        confirmAction(
            "Delete Post?",
            "Are you sure you want to delete this confession? This action cannot be undone.",
            async () => {
                // Optimistic update
                setConfessions(prev => prev.filter(c => c.id !== confession.id));
                setAllConf(prev => prev.filter(c => c.id !== confession.id));

                try {
                    const success = await db.deleteConfession(confession);
                    if (success) {
                        if (activeCommentConfessionId === confession.id) setActiveCommentConfessionId(null);
                        addToast('Post deleted', 'success');
                    } else {
                        throw new Error('Deletion failed');
                    }
                } catch (error: any) {
                    console.error("Delete error:", error);
                    // Revert optimistic update
                    const effectiveCollegeId = adminCollegeId || user.collegeId;
                    const targetCollegeId = feedTab === 'campus' ? effectiveCollegeId : 'world';
                    // Note: feedTab check 'campus' vs 'college' might differ in state. Logic says 'campus' or 'open'.
                    // I will just re-fetch to be safe.
                    handleRefresh(); // Simplest revert
                    addToast(`Failed to delete: ${error.message || 'Unknown error'}`, 'error');
                }
            }
        );
    }, [user, feedTab, adminCollegeId, activeCommentConfessionId, view, confirmAction, handleRefresh]);

    const handleReportConfession = useCallback((id: string) => {
        setReportingConfessionId(id);
        setShowReportModal(true);
    }, []);

    const handleSubmitReport = async (reason: string) => {
        if (!user || !reportingConfessionId) return;
        try {
            await db.submitReport(reportingConfessionId, user.id, reason);
            addToast('Report submitted. Thank you.', 'success');
        } catch (e) {
            addToast('Failed to submit report.', 'error');
        }
        setShowReportModal(false);
        setReportingConfessionId(null);
    };
    const handleProfileClick = useCallback(async (userId: string, isAnonymous: boolean) => { if (isAnonymous) return; if (userId === user?.id) { setView(AppView.PROFILE); return; } const target = await db.getUser(userId); if (target) { setSelectedUser(target); navigateTo(AppView.USER_PROFILE); } }, [user]);

    const handleFollowUser = useCallback(async (targetUserId: string) => {
        if (!user) return;

        const isFollowing = user.following?.includes(targetUserId);

        // Optimistic Updates
        setUser(prev => {
            if (!prev) return null;
            const following = prev.following || [];
            return {
                ...prev,
                following: isFollowing ? following.filter(id => id !== targetUserId) : [...following, targetUserId]
            };
        });

        if (selectedUser && selectedUser.id === targetUserId) {
            setSelectedUser(prev => {
                if (!prev) return null;
                const followers = prev.followers || [];
                return {
                    ...prev,
                    followers: isFollowing ? followers.filter(id => id !== user.id) : [...followers, user.id]
                };
            });
        }

        addToast(isFollowing ? 'Unfollowed' : 'Followed', 'success');

        try {
            if (isFollowing) {
                await db.unfollowUser(user.id, targetUserId);
            } else {
                await db.followUser(user.id, targetUserId);
            }
        } catch (e) {
            console.error("Follow action failed:", e);
            addToast("Action failed. Please try again.", "error");

            // Revert state logic could go here, but for simplicity we'll rely on refresh or ignoring for now
            // In a real app we'd revert the optimistic update
            const freshUser = await db.getUser(user.id);
            setUser(freshUser);
            const freshTarget = await db.getUser(targetUserId);
            if (selectedUser && selectedUser.id === targetUserId) setSelectedUser(freshTarget);
        }
    }, [user, selectedUser]);

    // --- Views ---

    const NotificationsView = ({ user, setView, setSelectedUser }: any) => {
        const [notifications, setNotifications] = useState<AppNotification[]>([]);

        useEffect(() => {
            if (!user) return;
            const fetch = async () => {
                const data = await db.getNotifications(user.id);
                setNotifications(data);
                if (data.some((n: AppNotification) => !n.read)) {
                    await db.markNotificationsRead(user.id);
                    setUnreadNotifCount(prev => Math.max(0, prev - data.filter((n: AppNotification) => !n.read).length)); // Local adjustment, eventually poll will fix exact number
                }
            };
            fetch();
        }, [user]);

        const handleNotificationClick = async (n: AppNotification) => {
            if (n.type === 'system') return; // detailed view?
            if (n.type === 'follow') {
                const u = await db.getUser(n.actorId);
                if (u) {
                    setSelectedUser(u);
                    setView(AppView.USER_PROFILE);
                }
            } else if (n.entityId) {
                const u = await db.getUser(n.actorId);
                if (u) {
                    setSelectedUser(u);
                    setView(AppView.USER_PROFILE);
                }
            }
        };

        return (
            <div className="animate-fade-in min-h-screen pb-safe bg-slate-50">
                <div className="sticky top-0 bg-white/90 backdrop-blur-md z-30 border-b border-slate-100 px-4 py-3">
                    <h2 className="font-black text-xl text-slate-900">Notifications</h2>
                </div>
                <div className="max-w-md mx-auto">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center text-slate-400">
                            <i className="far fa-bell text-4xl mb-4 opacity-50"></i>
                            <p>No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 bg-white shadow-sm rounded-none md:rounded-2xl mt-0 md:mt-4 overflow-hidden">
                            {notifications.filter((n: AppNotification) => n.type === 'system' || n.actorName !== 'New Confession').map((n: AppNotification) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className={`p-4 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer relative overflow-hidden ${n.type === 'system' && n.actorName !== 'New Confession'
                                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500'
                                        : !n.read ? 'bg-primary-50/50' : ''
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm z-10 ${n.type === 'system' && n.actorName !== 'New Confession' ? 'bg-amber-100 text-amber-600 ring-2 ring-white' :
                                        n.actorName === 'New Confession' ? 'bg-indigo-100 text-indigo-600' :
                                            'bg-slate-200'
                                        }`}>
                                        {n.type === 'system' && n.actorName !== 'New Confession' ? <i className="fas fa-shield-alt text-lg"></i> :
                                            n.actorName === 'New Confession' ? <i className="fas fa-feather-pointed"></i> :
                                                <img src={n.actorAvatar || `https://ui-avatars.com/api/?name=${n.actorName || 'User'}`} className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 z-10">
                                        <p className="text-sm text-slate-800">
                                            {n.type === 'system' && n.actorName !== 'New Confession' ? (
                                                <span className="font-black text-amber-700 uppercase tracking-wide text-xs">ADMIN ANNOUNCEMENT</span>
                                            ) : (
                                                <span className="font-bold">{n.actorName}</span>
                                            )}
                                            {n.type === 'like' && ' liked your post.'}
                                            {n.type === 'comment' && ' commented on your post.'}
                                            {n.type === 'follow' && ' started following you.'}
                                        </p>
                                        <p className={`text-xs mt-1 ${n.type === 'system' && n.actorName !== 'New Confession'
                                            ? 'text-amber-900 font-bold text-sm leading-snug'
                                            : n.actorName === 'New Confession' ? 'text-indigo-600 font-medium'
                                                : 'text-slate-500 line-clamp-1 italic'
                                            }`}>
                                            "{n.content}"
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-1">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    {n.type === 'system' && n.actorName !== 'New Confession' && <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none"><i className="fas fa-bullhorn text-6xl text-amber-500 transform rotate-12"></i></div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div >
        );
    };





    // --- Layout ---

    // --- Main Render ---

    // --- Main Render Logic ---
    let content;

    if (showSplash) {
        content = <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50"><div className="w-24 h-24 drop-shadow-2xl animate-float"><AppLogo className="w-full h-full" /></div><h1 className="mt-8 text-2xl font-black text-slate-800 tracking-tight">UniConfess</h1></div>;
    } else if (view === AppView.AUTH) {
        content = <AuthView setUser={setUser} setView={setView} addToast={addToast} />;
    } else if (view === AppView.SETUP_USERNAME) {
        content = (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-6 text-primary-600 text-3xl"><i className="fas fa-user-tag"></i></div>
                <h2 className="text-3xl font-black mb-2 text-slate-900">Choose a Handle</h2>
                <p className="text-slate-500 mb-8">This is how you'll be known on campus.</p>
                <div className="w-full max-w-xs relative mb-8">
                    <input
                        className={`w-full text-center text-2xl font-bold border-b-2 outline-none py-2 bg-transparent transition-colors ${usernameStatus === 'available' ? 'border-green-500' :
                            usernameStatus === 'taken' ? 'border-red-500' : 'border-slate-200 focus:border-primary-500'
                            }`}
                        placeholder="@username"
                        value={user?.username || ''}
                        onChange={e => {
                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            setUser(u => u ? { ...u, username: val } : null);
                            setDebouncedUsername(val);
                        }}
                    />
                    <div className="absolute top-1/2 -right-8 -translate-y-1/2">
                        {usernameStatus === 'checking' && <i className="fas fa-spinner animate-spin text-slate-400"></i>}
                        {usernameStatus === 'available' && <i className="fas fa-check-circle text-green-500"></i>}
                        {usernameStatus === 'taken' && <i className="fas fa-times-circle text-red-500"></i>}
                    </div>
                    {usernameStatus === 'taken' && <p className="text-red-500 text-xs font-bold mt-2">Handle already taken!</p>}
                    {debouncedUsername && debouncedUsername.length < 3 && <p className="text-slate-400 text-[10px] mt-2">Minimum 3 characters</p>}
                </div>
                <Button
                    className="w-full max-w-xs rounded-xl shadow-lg"
                    disabled={usernameStatus !== 'available' || !user?.username || user.username.length < 3}
                    onClick={async () => {
                        if (user?.username && usernameStatus === 'available') {
                            try {
                                await db.updateUser(user.id, { username: user.username });
                                setView(AppView.SETUP_COLLEGE);
                            } catch (e) {
                                addToast('Failed to save username. It might have been taken.', 'error');
                                setUsernameStatus('taken');
                            }
                        }
                    }}
                >
                    Continue
                </Button>
                <button
                    onClick={async () => {
                        await signOut();
                        setUser(null);
                        setView(AppView.AUTH);
                    }}
                    className="mt-10 text-rose-500 text-base font-black transition-all uppercase tracking-widest px-8 py-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm active:scale-95 flex items-center gap-2"
                >
                    <i className="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            </div>
        );
    } else if (view === AppView.POST) {
        content = <PostView onPostSuccess={handlePostSuccess} user={user} adminCollegeId={adminCollegeId} setView={setView} addToast={addToast} defaultVisibility={feedTab} />;
    } else if (view === AppView.SETUP_COLLEGE) {
        content = <SetupCollegeView user={user} colleges={colleges} setColleges={setColleges} setView={setView} setUser={setUser} />;
    } else if (view === AppView.SETUP_AVATAR) {
        content = (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <EditProfileView user={user!} onSave={async (updates) => { const updated = await db.updateUser(user!.id, updates); setUser(updated); setView(AppView.HOME); }} onCancel={() => setView(AppView.HOME)} />
            </div>
        );
    } else {
        content = (
            <Layout user={user} view={view} setView={setView} unreadMsgCount={unreadMsgCount} adminCollegeId={adminCollegeId} addToast={addToast} onPostSuccess={handlePostSuccess}>
                {view === AppView.HOME && (
                    <div className="animate-fade-in">
                        {refreshing && (
                            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-premium border border-slate-100 flex items-center gap-2 animate-bounce">
                                <i className="fas fa-circle-notch animate-spin text-primary-600 text-xs"></i>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Syncing...</span>
                            </div>
                        )}
                        <div className="sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-slate-50">
                            <div className="flex items-center justify-between px-6 py-4">
                                <div>
                                    <h2 className="font-extrabold text-xl text-slate-900 tracking-tight">UniConfess</h2>
                                    <p className="text-xs font-bold text-primary-600 uppercase tracking-wider mt-0.5">
                                        {colleges.find(c => c.id === (adminCollegeId || user.collegeId))?.name || 'My Campus'}
                                    </p>
                                </div>
                                <button onClick={() => navigateTo(AppView.NOTIFICATIONS)} className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors relative">
                                    <i className="far fa-bell text-lg"></i>
                                    {unreadNotifCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>}
                                </button>
                            </div>

                            <div className="flex px-4 border-b border-slate-50">
                                {[
                                    { id: 'campus', label: 'My Campus' },
                                    { id: 'open', label: 'Global' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setFeedTab(t.id as 'campus' | 'open')}
                                        className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-all relative ${feedTab === t.id ? 'text-primary-600' : 'text-slate-400 font-medium hover:text-slate-600'
                                            }`}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                                        {feedTab === t.id && (
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary-600 rounded-t-full shadow-glow-sm animate-fade-in-up"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(user?.isAdmin || user?.email === 'admin@yug.com') && (
                            <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-50">
                                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-slate-100 shadow-sm">
                                    <i className="fas fa-shield-alt text-primary-600 text-sm"></i>
                                    <select
                                        className="bg-transparent outline-none w-full text-xs font-bold text-slate-700"
                                        value={adminCollegeId || user.collegeId || ''}
                                        onChange={(e) => setAdminCollegeId(e.target.value)}
                                    >
                                        <option value={user.collegeId} disabled>Switch Campus View...</option>
                                        {colleges.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {adminCollegeId && <button onClick={() => setAdminCollegeId(null)} className="text-xs text-rose-500 font-bold hover:underline">Reset</button>}
                                </div>
                            </div>
                        )}

                        <div className="space-y-0 pb-32">
                            {confessions.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center">
                                    <div className="w-20 h-20 bg-primary-50 rounded-[2.5rem] flex items-center justify-center text-primary-600 text-3xl mb-6 shadow-sm">
                                        <i className="fas fa-feather-pointed"></i>
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg mb-2">No confessions yet</h3>
                                    <p className="text-slate-400 text-sm max-w-[240px]">Be the first to share a story from your campus.</p>
                                    <Button className="mt-8 rounded-xl px-8" onClick={() => navigateTo(AppView.POST)}>Start Sharing</Button>
                                </div>
                            ) : (
                                confessions.map(c => (
                                    <ConfessionItem
                                        key={c.id}
                                        confession={c}
                                        currentUser={user}
                                        onLike={handleLikeConfession}
                                        onDelete={handleDeleteConfession}
                                        onReply={(id) => setActiveCommentConfessionId(id)}
                                        onShare={(c) => setActiveShareConfession(c)}
                                        onProfileClick={handleProfileClick}
                                        onReport={handleReportConfession}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}

                {view === AppView.SEARCH && <SearchView user={user} setSelectedUser={setSelectedUser} navigateTo={navigateTo} />}
                {view === AppView.MESSAGES && <MessagesView user={user} setSelectedUser={setSelectedUser} navigateTo={navigateTo} confirmAction={confirmAction} />}
                {view === AppView.NOTIFICATIONS && <NotificationsView user={user} setView={setView} setSelectedUser={setSelectedUser} />}
                {view === AppView.CHAT_DETAIL && <ChatDetailView user={user} selectedUser={selectedUser} goBack={goBack} onMessagesRead={refreshUnreadCount} confirmAction={confirmAction} />}

                {view === AppView.PROFILE && user && (
                    <ProfileView
                        user={user}
                        setView={setView}
                        setUser={setUser}
                        navigateTo={navigateTo}
                        confessions={confessions}
                        colleges={colleges}
                        onDelete={handleDeleteConfession}
                        onLike={handleLikeConfession}
                        onUpdateProfile={async (updates) => {
                            const updated = await db.updateUser(user.id, updates);
                            setUser(updated);
                            addToast('Profile updated', 'success');
                        }}
                        onAccountDelete={async () => {
                            try {
                                await db.deleteAccount(user.id);
                                addToast('Your account was successfully deleted', 'success');
                                await signOut();
                                setUser(null);
                                setView(AppView.AUTH);
                            } catch (e) {
                                addToast('Failed to delete account', 'error');
                            }
                        }}
                        confirmAction={confirmAction}
                    />
                )}

                {view === AppView.MESSAGES && <MessagesView user={user} setSelectedUser={setSelectedUser} navigateTo={navigateTo} confirmAction={confirmAction} />}
                {view === AppView.CHAT_DETAIL && <ChatDetailView user={user} selectedUser={selectedUser} goBack={goBack} onMessagesRead={user ? (() => db.markAsRead(user.id, selectedUser?.id || '')) : undefined} confirmAction={confirmAction} />}

                {view === AppView.ADMIN && <AdminPanel onBack={goBack} confirmAction={confirmAction} />}
                {activeCommentConfessionId && <CommentsSheet confessionId={activeCommentConfessionId} onClose={() => setActiveCommentConfessionId(null)} />}
                {activeShareConfession && <ShareSheet confession={activeShareConfession} onClose={() => setActiveShareConfession(null)} />}
                {showReportModal && <ReportModal onClose={() => { setShowReportModal(false); setReportingConfessionId(null); }} onSubmit={handleSubmitReport} />}

                <ConfirmModal
                    isOpen={confirmState.isOpen}
                    title={confirmState.title}
                    message={confirmState.message}
                    onConfirm={confirmState.onConfirm}
                    onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                    type={confirmState.type}
                />
            </Layout>
        );
    }

    return (
        <>
            {content}
            <div className="fixed bottom-24 md:bottom-10 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2 w-max max-w-[90%] pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className="bg-slate-900/90 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] font-black text-sm animate-slide-up text-center border border-white/10 ring-1 ring-black/5 flex items-center gap-3">
                        {t.type === 'error' && <i className="fas fa-exclamation-circle text-rose-500"></i>}
                        {t.type === 'success' && <i className="fas fa-check-circle text-emerald-500"></i>}
                        {t.type === 'info' && <i className="fas fa-info-circle text-primary-500"></i>}
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </>
    );
}


import { supabase } from './supabaseClient';
import { User, Confession, College, Message, Comment, Report, Notification as AppNotification, CollegeRequest } from '../types';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser
} from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// --- Firebase Configuration (for Auth only) ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// --- Firebase Configuration (for Auth only) ---

// Initialize Messaging
// Note: messaging is only supported in browser environments with Service Worker
let messaging: any = null;
try {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        // Attempt to initialize, but catch specific unsupported browser errors
        try {
            messaging = getMessaging(app);
        } catch (e) {
            console.log('Firebase Messaging not supported');
        }
    }
} catch (err) {
    console.log('Firebase Messaging check failed');
}

// --- Helpers ---
const ensureNumber = (val: any) => typeof val === 'string' ? parseInt(val) : Number(val);

class SupabaseService {
    private currentUser: User | null = null;
    private authStateListener: any;

    constructor() {
        this.authStateListener = onAuthStateChanged(auth, async (user) => {
            if (user) {
                let dbUser = await this.getUser(user.uid);
                if (!dbUser) {
                    // Heal: Create missing user record for existing Firebase Auth user
                    const newUser: User = {
                        id: user.uid,
                        email: user.email || '',
                        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.uid}&backgroundColor=e0e7ff`,
                        createdAt: Date.now(),
                        following: [],
                        followers: [],
                        isAdmin: false,
                        acceptedChats: [],
                        blockedUsers: []
                    };
                    const { error } = await supabase.from('users').insert(newUser);
                    if (!error) dbUser = newUser;
                }
                this.currentUser = dbUser;
            } else {
                this.currentUser = null;
            }
        });
    }

    // --- Auth (Firebase) ---

    async checkEmailAvailability(email: string): Promise<boolean> {
        return true; // Let Firebase handle it
    }

    async checkUsernameAvailability(username: string): Promise<boolean> {
        if (!username) return false;
        const { data } = await supabase.from('users').select('username').eq('username', username);
        return !data || data.length === 0;
    }

    async login(email: string, password: string): Promise<User | null> {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            let user = await this.getUser(uid);

            if (!user && userCredential.user) {
                // Heal: Create user in Supabase if missing
                const newUser: User = {
                    id: uid,
                    email: userCredential.user.email || '',
                    avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${uid}&backgroundColor=e0e7ff`,
                    createdAt: Date.now(),
                    following: [],
                    followers: [],
                    isAdmin: false,
                    acceptedChats: [],
                    blockedUsers: []
                };
                const { error } = await supabase.from('users').insert(newUser);
                if (error) throw new Error("Database error: " + error.message);
                user = newUser;
            }

            this.currentUser = user;
            return user;
        } catch (error: any) {
            console.error("Login failed", error);
            throw error;
        }
    }

    async register(email: string, password: string): Promise<User> {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const isAdmin = email === 'admin@yug.com';

        const newUser: User = {
            id: uid,
            email,
            avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${uid}&backgroundColor=e0e7ff`,
            createdAt: Date.now(),
            following: [],
            followers: [],
            isAdmin,
            acceptedChats: [],
            blockedUsers: []
        };

        const { error } = await supabase.from('users').insert(newUser);
        if (error) {
            console.error("Error creating user in Supabase", error);
            // Optional: delete firebase user if db insert fails to keep consistency? 
            // For now, just throw so UI knows.
            throw new Error("Failed to create user profile: " + error.message);
        }

        this.currentUser = newUser;
        return newUser;
    }

    async ensureClerkUser(clerkUser: any): Promise<User> {
        // 1. Try finding by Clerk ID (New mechanism)
        const existing = await this.getUser(clerkUser.id);
        if (existing) return existing;

        // 2. Try finding by Email (Migration for Firebase users)
        const email = clerkUser.primaryEmailAddress.emailAddress;
        if (email) {
            const { data: legacyUser } = await supabase.from('users').select('*').eq('email', email).single();
            if (legacyUser) {
                // Return the legacy user (retains Firebase UID as ID)
                // This means appUser.id != clerkUser.id, but data stays intact.
                // Optionally update avatar/metadata here if needed.
                return { ...legacyUser, createdAt: ensureNumber(legacyUser.createdAt) } as User;
            }
        }

        // 3. Create New User (No ID, No Email match)
        const newUser: User = {
            id: clerkUser.id,
            email: email,
            createdAt: Date.now(),
            following: [],
            followers: [],
            isAdmin: false,
            acceptedChats: [],
            blockedUsers: []
        };

        const { error } = await supabase.from('users').insert(newUser);
        if (error) {
            console.error("Error creating user from Clerk:", error);
            throw error;
        }
        return newUser;
    }

    async getCurrentUser(): Promise<User | null> {
        if (this.currentUser) return this.currentUser;
        if (auth.currentUser) {
            this.currentUser = await this.getUser(auth.currentUser.uid);
            return this.currentUser;
        }
        return null;
    }

    async logout() {
        await signOut(auth);
        this.currentUser = null;
    }

    async getUser(uid: string): Promise<User | null> {
        const { data, error } = await supabase.from('users').select('*').eq('id', uid).single();
        if (error || !data) return null;
        return { ...data, createdAt: ensureNumber(data.createdAt) } as User;
    }

    async updateUser(userId: string, updates: Partial<User>): Promise<User> {
        const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
        if (error) throw error;
        const updated = { ...data, createdAt: ensureNumber(data.createdAt || 0) } as User;

        if (this.currentUser && this.currentUser.id === userId) {
            this.currentUser = updated;
        }
        return updated;
    }

    async getAllUsers(): Promise<User[]> {
        const { data } = await supabase.from('users').select('*');
        return (data || []).map(u => ({ ...u, createdAt: ensureNumber(u.createdAt) } as User));
    }

    async deleteUser(userId: string) {
        await supabase.from('users').delete().eq('id', userId);
    }

    async deleteAccount(userId: string) {
        // 1. Delete notifications
        await supabase.from('notifications').delete().or(`userId.eq.${userId},actorId.eq.${userId}`);

        // 2. Delete messages
        await supabase.from('messages').delete().or(`senderId.eq.${userId},receiverId.eq.${userId}`);

        // 3. Delete comments
        await supabase.from('comments').delete().eq('userId', userId);

        // 4. Delete confessions
        await supabase.from('confessions').delete().eq('userId', userId);

        // 5. Delete user profile
        await supabase.from('users').delete().eq('id', userId);

        // 6. Sign out
        await this.logout();
    }

    // --- Social Actions ---
    async followUser(currentUserId: string, targetUserId: string): Promise<void> {
        const u1 = await this.getUser(currentUserId);
        const u2 = await this.getUser(targetUserId);

        if (u1 && u2) {
            let following = u1.following || [];
            let followers = u2.followers || [];

            if (!following.includes(targetUserId)) {
                following = [...following, targetUserId];
                await supabase.from('users').update({ following }).eq('id', currentUserId);
                // System notification removed as requested
            }
            if (!followers.includes(currentUserId)) {
                followers = [...followers, currentUserId];
                await supabase.from('users').update({ followers }).eq('id', targetUserId);
            }
        }
    }

    async unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
        const u1 = await this.getUser(currentUserId);
        const u2 = await this.getUser(targetUserId);

        if (u1 && u2) {
            const following = (u1.following || []).filter(id => id !== targetUserId);
            const followers = (u2.followers || []).filter(id => id !== currentUserId);

            await supabase.from('users').update({ following }).eq('id', currentUserId);
            await supabase.from('users').update({ followers }).eq('id', targetUserId);
        }
    }

    async blockUser(currentUserId: string, targetUserId: string): Promise<void> {
        const user = await this.getUser(currentUserId);
        if (user) {
            let blockedUsers = user.blockedUsers || [];
            if (!blockedUsers.includes(targetUserId)) {
                blockedUsers = [...blockedUsers, targetUserId];
                await supabase.from('users').update({ blockedUsers }).eq('id', currentUserId);

                // Also unfollow automatically
                await this.unfollowUser(currentUserId, targetUserId);
                await this.unfollowUser(targetUserId, currentUserId);

                // Also clear chat history from current user's accepted list
                let acceptedChats = user.acceptedChats || [];
                acceptedChats = acceptedChats.filter(id => id !== targetUserId);
                await supabase.from('users').update({ acceptedChats }).eq('id', currentUserId);
            }
        }
    }

    async unblockUser(currentUserId: string, targetUserId: string): Promise<void> {
        const user = await this.getUser(currentUserId);
        if (user && user.blockedUsers) {
            const blockedUsers = user.blockedUsers.filter(id => id !== targetUserId);
            await supabase.from('users').update({ blockedUsers }).eq('id', currentUserId);
        }
    }

    // --- Colleges ---
    async getColleges(): Promise<College[]> {
        const { data } = await supabase.from('colleges').select('*');
        return data as College[] || [];
    }

    async addCollege(name: string): Promise<College> {
        // Generating ID simply or let DB handle it? Code expects ID.
        // We'll trust the DB insert to return ID if we used uuid, but here we used text ID in seed.
        // Let's generate a simple ID if not provided, or let user edit.
        // For new items, we can use a random string
        const id = 'c' + Date.now();
        const { data } = await supabase.from('colleges').insert({ id, name }).select().single();
        return data as College;
    }

    async updateCollege(id: string, name: string): Promise<void> {
        const { error } = await supabase.from('colleges').update({ name }).eq('id', id);
        if (error) {
            console.error('Error updating college:', error);
            throw new Error(`Failed to update college: ${error.message}`);
        }
    }

    async deleteCollege(id: string): Promise<void> {
        console.log('Attempting to delete college:', id);
        const { error } = await supabase.from('colleges').delete().eq('id', id);
        if (error) {
            console.error('Error deleting college:', error);
            throw new Error(`Failed to delete college: ${error.message}`);
        }
        console.log('College deleted successfully:', id);
    }

    async requestCollege(name: string, location: string, userId: string): Promise<void> {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const req: CollegeRequest = {
            id,
            name,
            location,
            requestedBy: userId,
            status: 'pending',
            timestamp: Date.now()
        };
        const { error } = await supabase.from('college_requests').insert(req);
        if (error) {
            console.error('Error requesting college:', error);
            throw error;
        }
    }

    async getCollegeRequests(): Promise<CollegeRequest[]> {
        const { data } = await supabase.from('college_requests').select('*');
        return (data || []).map(r => ({ ...r, timestamp: ensureNumber(r.timestamp) } as CollegeRequest)).sort((a, b) => b.timestamp - a.timestamp);
    }

    async approveCollegeRequest(requestId: string, finalName: string): Promise<void> {
        const { data: req } = await supabase.from('college_requests').select('*').eq('id', requestId).single();
        if (req) {
            // Add college
            await this.addCollege(finalName);
            // Delete the request (admin want it removed as per instructions "delete them")
            await supabase.from('college_requests').delete().eq('id', requestId);
            // Notify user
            await this.createNotification(req.requestedBy, 'system', 'system', 'System', '', undefined, `Your request to add "${req.name}" (approved as "${finalName}") has been approved.`);
        }
    }

    async rejectCollegeRequest(requestId: string): Promise<void> {
        await supabase.from('college_requests').delete().eq('id', requestId);
    }

    // --- Confessions ---
    subscribeToConfessions(collegeId: string, visibility: 'campus' | 'open', callback: (data: Confession[]) => void) {
        const fetchByVisibility = async () => {
            let query = supabase.from('confessions').select('*');

            if (visibility === 'campus') {
                query = query.eq('collegeId', collegeId).eq('visibility', 'campus');
            } else {
                query = query.eq('visibility', 'open');
            }

            const { data } = await query;

            if (data) {
                const parsed = data.map(c => ({
                    ...c,
                    timestamp: ensureNumber(c.timestamp),
                    likes: c.likes || []
                })) as Confession[];
                const filtered = parsed.filter(c => !c.hidden).sort((a, b) => b.timestamp - a.timestamp);
                callback(filtered);
            }
        };

        fetchByVisibility();

        const channelId = visibility === 'campus' ? `confessions-campus-${collegeId}` : `confessions-open`;
        const channel = supabase.channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'confessions'
                },
                (payload) => {
                    // Refresh if visibility matches
                    const newData = payload.new as any;
                    if (payload.eventType === 'INSERT') {
                        if (newData.visibility === visibility) {
                            if (visibility === 'open' || newData.collegeId === collegeId) {
                                fetchByVisibility();
                            }
                        }
                    } else {
                        // For updates/deletes, just refresh
                        fetchByVisibility();
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }

    async createConfession(userId: string, username: string, content: string, collegeId: string, isAnonymous: boolean, userAvatar?: string, visibility: 'campus' | 'open' = 'campus'): Promise<Confession> {
        // Robust ID generation with fallback
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'conf-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const newConfession = {
            id,
            "userId": userId,
            username,
            "userAvatar": userAvatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&backgroundColor=e0e7ff`,
            content,
            "collegeId": collegeId,
            timestamp: Date.now(),
            "isAnonymous": isAnonymous,
            likes: [],
            hidden: false,
            visibility
        };

        console.log('Inserting confession:', newConfession);
        const { data, error } = await supabase.from('confessions').insert(newConfession).select().single();

        if (error) {
            console.error('Supabase insert error [confessions]:', error);
            throw error;
        }

        return { ...data, timestamp: ensureNumber(data.timestamp) } as Confession;
    }

    async deleteConfession(confessionOrId: string | Confession): Promise<boolean> {
        const id = typeof confessionOrId === 'string' ? confessionOrId : confessionOrId.id;
        console.log('Attempting to delete confession:', id);
        const { error } = await supabase.from('confessions').delete().eq('id', id);
        if (error) {
            console.error('Error deleting confession:', error);
            throw new Error(`Failed to delete confession: ${error.message}`);
        }
        console.log('Confession deleted successfully:', id);
        return true;
    }

    async hideConfession(confessionId: string, userId: string): Promise<boolean> {
        // userId param unused in query but kept for interface consistency or future validation
        const { error } = await supabase.from('confessions').update({ hidden: true }).eq('id', confessionId);
        return !error;
    }

    async toggleLike(confessionId: string, userId: string): Promise<void> {
        const { error } = await supabase.rpc('toggle_like', { confession_id: confessionId, user_id: userId });
        if (error) throw error;

        // Fetch confession to check if liked and get owner
        const { data: conf } = await supabase.from('confessions').select('*').eq('id', confessionId).single();
        if (conf && conf.likes && conf.likes.includes(userId) && conf.userId !== userId) {
            // Notification removed
        }
    }

    async getConfessionsByCollege(collegeId: string): Promise<Confession[]> {
        const { data } = await supabase.from('confessions').select('*').eq('collegeId', collegeId);
        return (data || []).map(c => ({ ...c, timestamp: ensureNumber(c.timestamp) } as Confession))
            .filter(c => !c.hidden).sort((a, b) => b.timestamp - a.timestamp);
    }

    async getConfessionsByUser(userId: string): Promise<Confession[]> {
        const { data } = await supabase.from('confessions').select('*').eq('userId', userId);
        return (data || []).map(c => ({ ...c, timestamp: ensureNumber(c.timestamp) } as Confession))
            .filter(c => !c.hidden).sort((a, b) => b.timestamp - a.timestamp);
    }

    async getAllConfessions(): Promise<Confession[]> {
        const { data } = await supabase.from('confessions').select('*');
        return (data || []).map(c => ({ ...c, timestamp: ensureNumber(c.timestamp) } as Confession))
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    // --- Comments ---
    async addComment(confessionId: string, userId: string, username: string, content: string): Promise<Comment> {
        const comment = {
            id: crypto.randomUUID(),
            "confessionId": confessionId,
            "userId": userId,
            username,
            content,
            timestamp: Date.now()
        };
        const { data, error } = await supabase.from('comments').insert(comment).select().single();
        if (error) throw error;

        // Notify owner removed

        return { ...data, timestamp: ensureNumber(data.timestamp) } as Comment;
    }

    async getComments(confessionId: string): Promise<Comment[]> {
        const { data } = await supabase.from('comments').select('*').eq('confessionId', confessionId);
        return (data || []).map(c => ({ ...c, timestamp: ensureNumber(c.timestamp) } as Comment))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    // --- Messages ---
    async sendMessage(senderId: string, receiverId: string, content: string): Promise<Message> {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        // Check if blocked
        const receiver = await this.getUser(receiverId);
        if (receiver && receiver.blockedUsers?.includes(senderId)) {
            throw new Error("You are blocked by this user.");
        }
        const sender = await this.getUser(senderId);
        if (sender && sender.blockedUsers?.includes(receiverId)) {
            throw new Error("You have blocked this user.");
        }

        const msg = {
            id,
            "senderId": senderId,
            "receiverId": receiverId,
            content,
            timestamp: Date.now(),
            read: false
        };

        const { data, error } = await supabase.from('messages').insert(msg).select().single();
        if (error) {
            console.error('Error sending message:', error);
            throw error;
        }
        await this.acceptChat(senderId, receiverId);
        return { ...data, timestamp: ensureNumber(data.timestamp) } as Message;
    }

    subscribeToMessages(userId: string, onUpdate: (m: Message) => void) {
        return supabase
            .channel(`public:messages:receiverId=eq.${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiverId=eq.${userId}`
            }, async payload => {
                // Check if sender is blocked before updating UI
                const u = await this.getUser(userId);
                if (u && !u.blockedUsers?.includes((payload.new as any).senderId)) {
                    onUpdate({ ...payload.new, timestamp: ensureNumber((payload.new as any).timestamp) } as Message);
                }
            })
            .subscribe();
    }

    async getMessages(userId1: string, userId2: string): Promise<Message[]> {
        // Fetch all messages where (sender=u1 AND receiver=u2) OR (sender=u2 AND receiver=u1)
        const { data } = await supabase.from('messages').select('*')
            .or(`and(senderId.eq.${userId1},receiverId.eq.${userId2}),and(senderId.eq.${userId2},receiverId.eq.${userId1})`);

        return (data || []).map(m => ({ ...m, timestamp: ensureNumber(m.timestamp) } as Message))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async getInbox(userId: string): Promise<{ requests: string[], accepted: string[] }> {
        const user = await this.getUser(userId);
        if (!user) return { requests: [], accepted: [] };

        const { data: messages } = await supabase.from('messages').select('senderId, receiverId')
            .or(`senderId.eq.${userId},receiverId.eq.${userId}`);

        const partners = new Set<string>();
        messages?.forEach((m: any) => {
            partners.add(m.senderId === userId ? m.receiverId : m.senderId);
        });

        const reqs: Set<string> = new Set();
        const accs: Set<string> = new Set();
        const blockedUsers = user.blockedUsers || [];

        user.acceptedChats?.forEach(id => {
            if (!blockedUsers.includes(id)) accs.add(id);
        });

        partners.forEach(pid => {
            if (blockedUsers.includes(pid)) return; // Skip if I blocked them

            const isFollowing = user.following?.includes(pid);
            const explicit = user.acceptedChats?.includes(pid);
            const sentByMe = messages?.some((m: any) => m.senderId === userId && m.receiverId === pid);

            if (isFollowing || explicit || sentByMe) {
                accs.add(pid);
            } else {
                reqs.add(pid);
            }
        });

        accs.forEach(id => reqs.delete(id));
        return { requests: Array.from(reqs), accepted: Array.from(accs) };
    }

    async acceptChat(currentUserId: string, peerId: string): Promise<void> {
        const user = await this.getUser(currentUserId);
        if (user) {
            const acceptedChats = user.acceptedChats || [];
            if (!acceptedChats.includes(peerId)) {
                await supabase.from('users').update({ acceptedChats: [...acceptedChats, peerId] }).eq('id', currentUserId);
            }
        }
    }

    async rejectChat(currentUserId: string, peerId: string): Promise<void> {
        // Delete messages between them
        await supabase.from('messages').delete()
            .or(`and(senderId.eq.${currentUserId},receiverId.eq.${peerId}),and(senderId.eq.${peerId},receiverId.eq.${currentUserId})`);

        // Remove from accepted
        const user = await this.getUser(currentUserId);
        if (user && user.acceptedChats) {
            const acceptedChats = user.acceptedChats.filter(id => id !== peerId);
            await supabase.from('users').update({ acceptedChats }).eq('id', currentUserId);
        }
    }

    async markAsRead(currentUserId: string, peerId: string): Promise<void> {
        // Update read=true where receiver=currentUserId AND sender=peerId
        await supabase.from('messages').update({ read: true })
            .match({ receiverId: currentUserId, senderId: peerId, read: false });
    }

    async getUnreadCount(userId: string): Promise<number> {
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
            .match({ receiverId: userId, read: false });
        return count || 0;
    }

    async getUnreadCountsPerPeer(userId: string): Promise<Record<string, number>> {
        const { data, error } = await supabase
            .from('messages')
            .select('senderId')
            .eq('receiverId', userId)
            .eq('read', false);

        if (error) {
            console.error('Error getting unread counts per peer:', error);
            return {};
        }

        const counts: Record<string, number> = {};
        data?.forEach((m: any) => {
            counts[m.senderId] = (counts[m.senderId] || 0) + 1;
        });
        return counts;
    }

    async hasUnreadFrom(currentUserId: string, peerId: string): Promise<boolean> {
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
            .match({ receiverId: currentUserId, senderId: peerId, read: false });
        return (count || 0) > 0;
    }

    async isUsernameAvailable(username: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        if (error) {
            console.error("Error checking username availability:", error);
            return false;
        }

        return !data;
    }

    // --- Admin & Reports ---
    async getReports(): Promise<Report[]> {
        const { data } = await supabase.from('reports').select('*');
        return (data || []).map(r => ({ ...r, timestamp: ensureNumber(r.timestamp) } as Report))
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    async submitReport(confessionId: string, reporterId: string, reason: string): Promise<void> {
        const report = {
            id: crypto.randomUUID(),
            "confessionId": confessionId,
            "reporterId": reporterId,
            reason,
            timestamp: Date.now(),
            status: 'pending'
        };
        await supabase.from('reports').insert(report);
    }

    async resolveReport(reportId: string, status: 'resolved' | 'dismissed', adminId: string): Promise<void> {
        await supabase.from('reports').update({ status, resolvedBy: adminId }).eq('id', reportId);
    }

    async deleteReport(reportId: string): Promise<void> {
        await supabase.from('reports').delete().eq('id', reportId);
    }

    async banUser(userId: string): Promise<void> {
        await supabase.from('users').update({ isBanned: true }).eq('id', userId);
    }

    async unbanUser(userId: string): Promise<void> {
        await supabase.from('users').update({ isBanned: false }).eq('id', userId);
    }

    async suspendUser(userId: string, until: number): Promise<void> {
        await supabase.from('users').update({ suspendedUntil: until }).eq('id', userId);
    }

    async polishText(text: string): Promise<string> {
        // Mock AI polishing for now - in production this would call an LLM
        if (!text) return "";
        await new Promise(r => setTimeout(r, 1000)); // Simulate AI delay
        return text
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/^./, str => str.toUpperCase()); // Capitalize start
    }

    // --- Notifications ---
    async createNotification(userId: string, type: 'like' | 'comment' | 'follow' | 'system', actorId: string, actorName: string, actorAvatar?: string, entityId?: string, content?: string): Promise<void> {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const n = {
            id,
            "userId": userId,
            type,
            "actorId": actorId,
            "actorName": actorName,
            "actorAvatar": actorAvatar || '',
            "entityId": entityId,
            content,
            read: false,
            timestamp: Date.now()
        };
        const { error } = await supabase.from('notifications').insert(n);
        if (error) console.error('Error creating notification:', error);
    }

    async getNotifications(userId: string): Promise<AppNotification[]> {
        const { data } = await supabase.from('notifications').select('*').eq('userId', userId).order('timestamp', { ascending: false }).limit(50);
        return (data || []).map(n => ({ ...n, timestamp: ensureNumber(n.timestamp) } as AppNotification));
    }

    async markNotificationsRead(userId: string): Promise<void> {
        await supabase.from('notifications').update({ read: true }).eq('userId', userId).eq('read', false);
    }

    async getUnreadNotificationCount(userId: string): Promise<number> {
        const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('userId', userId).eq('read', false);
        return count || 0;
    }

    async sendSystemNotification(message: string, targetCollegeId?: string): Promise<void> {
        let users: User[] = [];
        if (targetCollegeId) {
            const { data } = await supabase.from('users').select('*').eq('collegeId', targetCollegeId);
            users = data as User[] || [];
        } else {
            users = await this.getAllUsers();
        }

        const notifs = users.map(u => {
            const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : 'notif-sys-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            return {
                id,
                "userId": u.id,
                type: 'system',
                "actorId": 'system',
                "actorName": 'Admin',
                "actorAvatar": '',
                content: message,
                read: false,
                timestamp: Date.now()
            };
        });

        if (notifs.length > 0) {
            const { error } = await supabase.from('notifications').insert(notifs);
            if (error) {
                console.error('Error sending system notifications:', error);
                throw error;
            }
        }
    }

    subscribeToNotifications(userId: string, onUpdate: (n: AppNotification) => void) {
        return supabase
            .channel(`public:notifications:userId=eq.${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `userId=eq.${userId}` }, payload => {
                const newData = payload.new as any;
                onUpdate({ ...newData, timestamp: ensureNumber(newData.timestamp) } as AppNotification);
            })
            .subscribe();
    }

    subscribeToCollegeRequests(onUpdate: (r: CollegeRequest) => void) {
        return supabase
            .channel('public:college_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'college_requests' }, payload => {
                const newData = payload.new as any;
                if (!newData.timestamp) return;
                onUpdate({ ...newData, timestamp: ensureNumber(newData.timestamp) } as CollegeRequest);
            })
            .subscribe();
    }

    async requestNotificationPermission(userId: string) {
        if (!messaging) return;
        try {
            const permission = await window.Notification.requestPermission();
            if (permission === 'granted') {
                // Get token
                // Note: You might need a VAPID key here: getToken(messaging, { vapidKey: 'YOUR_PUBLIC_VAPID_KEY' });
                const token = await getToken(messaging, {
                    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
                });

                if (token) {
                    console.log('FCM Token:', token);
                    await supabase.from('users').update({ fcmToken: token }).eq('id', userId);
                }
            } else {
                console.log('Notification permission denied');
            }
        } catch (err) {
            console.error('Error requesting notification permission:', err);
        }
    }

    onMessageListener() {
        if (!messaging) return null;
        return new Promise((resolve) => {
            onMessage(messaging, (payload) => {
                resolve(payload);
            });
        });
    }
}

export const db = new SupabaseService();

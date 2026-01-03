import { initializeApp } from 'firebase/app';
import {
    getDatabase,
    ref,
    set,
    get,
    push,
    child,
    update,
    remove,
    onValue,
    query,
    orderByChild,
    equalTo,
    off
} from 'firebase/database';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser
} from 'firebase/auth';
import { User, Confession, College, Message, Comment } from '../types';

// --- Configuration ---
// Ensure these are set in your .env.local
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// --- Helper Functions ---
const snapshotToData = <T>(snapshot: any): T[] => {
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.values(data) as T[];
};

class RealFirebaseService {
    private currentUser: User | null = null;

    constructor() {
        // Listen to auth state changes to keep local user state in sync if needed
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const dbUser = await this.getUser(user.uid);
                this.currentUser = dbUser;
            } else {
                this.currentUser = null;
            }
        });
    }

    // --- Auth ---

    async checkEmailAvailability(email: string): Promise<boolean> {
        // Firebase Auth handles duplicate emails on register, but we can't easily check without trying.
        // For a simple app, we'll rely on register failing.
        // Alternatively, we could query our users node if we index by email (not recommended for PII).
        // Returning true to let Auth handle it.
        return true;
    }

    async checkUsernameAvailability(username: string): Promise<boolean> {
        if (!username) return false;
        const usersRef = ref(database, 'users');
        const q = query(usersRef, orderByChild('username'), equalTo(username));
        const snapshot = await get(q);
        return !snapshot.exists();
    }

    async login(email: string, password: string): Promise<User | null> {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            const user = await this.getUser(uid);
            this.currentUser = user;
            return user;
        } catch (error) {
            console.error("Login failed", error);
            return null;
        }
    }

    async register(email: string, password: string): Promise<User> {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const isAdmin = email === 'admin@yug.com'; // Specific admin check

        const newUser: User = {
            id: uid,
            email,
            createdAt: Date.now(),
            following: [],
            followers: [],
            isAdmin,
            acceptedChats: []
        };

        // Fire and forget the DB write to speed up UI response
        set(ref(database, `users/${uid}`), newUser).catch(e => console.error("Error creating user DB entry", e));

        this.currentUser = newUser;
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
        const snapshot = await get(ref(database, `users/${uid}`));
        if (snapshot.exists()) {
            return snapshot.val() as User;
        }
        return null;
    }

    async updateUser(userId: string, updates: Partial<User>): Promise<User> {
        const userRef = ref(database, `users/${userId}`);
        await update(userRef, updates);
        const updated = await this.getUser(userId);
        if (updated && this.currentUser && this.currentUser.id === userId) {
            this.currentUser = updated;
        }
        return updated!;
    }

    async getAllUsers(): Promise<User[]> {
        const snapshot = await get(ref(database, 'users'));
        return snapshotToData<User>(snapshot);
    }

    async deleteUser(userId: string) {
        await remove(ref(database, `users/${userId}`));
    }

    // --- Social Actions ---
    async followUser(currentUserId: string, targetUserId: string): Promise<void> {
        const u1 = await this.getUser(currentUserId);
        const u2 = await this.getUser(targetUserId);

        if (u1 && u2) {
            const following = u1.following || [];
            const followers = u2.followers || [];

            if (!following.includes(targetUserId)) {
                following.push(targetUserId);
                await update(ref(database, `users/${currentUserId}`), { following });
            }
            if (!followers.includes(currentUserId)) {
                followers.push(currentUserId);
                await update(ref(database, `users/${targetUserId}`), { followers });
            }
        }
    }

    async unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
        const u1 = await this.getUser(currentUserId);
        const u2 = await this.getUser(targetUserId);

        if (u1 && u2) {
            const following = (u1.following || []).filter(id => id !== targetUserId);
            const followers = (u2.followers || []).filter(id => id !== currentUserId);

            await update(ref(database, `users/${currentUserId}`), { following });
            await update(ref(database, `users/${targetUserId}`), { followers });
        }
    }

    // --- Colleges ---
    async getColleges(): Promise<College[]> {
        const snapshot = await get(ref(database, 'colleges'));
        if (!snapshot.exists()) {
            // Seed initial colleges if empty
            const INITIAL_COLLEGES = [
                { id: 'c1', name: 'Imperial College of Engineering' },
                { id: 'c2', name: 'St. Mary\'s Medical School' },
                { id: 'c3', name: 'Royal Arts Academy' },
                { id: 'c4', name: 'National Business School' },
                { id: 'c5', name: 'Tech Valley University' },
                { id: 'c6', name: 'Cyber Institute of Technology' },
                { id: 'c7', name: 'Global Design School' },
                { id: 'c8', name: 'State University of Law' }
            ];
            const updates: any = {};
            INITIAL_COLLEGES.forEach(c => updates[`colleges/${c.id}`] = c);
            await update(ref(database), updates);
            return INITIAL_COLLEGES;
        }
        return snapshotToData<College>(snapshot);
    }

    async addCollege(name: string): Promise<College> {
        const newRef = push(ref(database, 'colleges'));
        const newCollege = { id: newRef.key!, name };
        await set(newRef, newCollege);
        return newCollege;
    }

    async updateCollege(id: string, name: string): Promise<void> {
        await update(ref(database, `colleges/${id}`), { name });
    }

    async deleteCollege(id: string): Promise<void> {
        await remove(ref(database, `colleges/${id}`));
    }

    // --- Confessions ---
    subscribeToConfessions(collegeId: string, callback: (data: Confession[]) => void) {
        const confessionsRef = ref(database, 'confessions');
        // In a real app, you'd want to index by collegeId and query that.
        // For now, we'll filter client-side or fetch all if dataset is small.
        // Better: query(confessionsRef, orderByChild('collegeId'), equalTo(collegeId))
        // But that requires an index rule in Firebase.

        let q;
        if (collegeId === 'world') {
            q = query(confessionsRef, orderByChild('timestamp'));
        } else {
            q = query(confessionsRef, orderByChild('collegeId'), equalTo(collegeId));
        }

        const unsubscribe = onValue(q, (snapshot) => {
            const data = snapshotToData<Confession>(snapshot);
            const filtered = data.filter(c => !c.hidden).sort((a, b) => b.timestamp - a.timestamp);
            callback(filtered);
        });

        // Fallback if empty (optional, mirroring mock behavior)
        // If q returns empty, maybe show all? Not standard for real app but keeping logic similar.
        // Actually, let's stick to strict college filtering for a real app.

        return unsubscribe;
    }

    async createConfession(userId: string, username: string, content: string, collegeId: string, isAnonymous: boolean, userAvatar?: string): Promise<Confession> {
        if (!collegeId) throw new Error("College ID is required to post a confession.");

        const newRef = push(ref(database, 'confessions'));
        const newConfession: Confession = {
            id: newRef.key!,
            userId,
            username,
            userAvatar: userAvatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&backgroundColor=e0e7ff`,
            content,
            collegeId,
            timestamp: Date.now(),
            isAnonymous,
            likes: [],
            hidden: false
        };
        // Ensure no undefined values are passed to Firebase
        const cleanConfession = JSON.parse(JSON.stringify(newConfession));
        await set(newRef, cleanConfession);
        return newConfession;
    }

    async deleteConfession(confessionOrId: string | Confession): Promise<boolean> {
        const id = typeof confessionOrId === 'string' ? confessionOrId : confessionOrId.id;
        await remove(ref(database, `confessions/${id}`));
        return true;
    }

    async hideConfession(confessionId: string, userId: string): Promise<boolean> {
        await update(ref(database, `confessions/${confessionId}`), { hidden: true });
        return true;
    }

    async toggleLike(confessionId: string, userId: string): Promise<void> {
        const confessionRef = ref(database, `confessions/${confessionId}`);
        const snapshot = await get(confessionRef);
        if (snapshot.exists()) {
            const c = snapshot.val() as Confession;
            let likes = c.likes || [];
            if (likes.includes(userId)) {
                likes = likes.filter(id => id !== userId);
            } else {
                likes.push(userId);
            }
            await update(confessionRef, { likes });
        }
    }

    async getConfessionsByCollege(collegeId: string): Promise<Confession[]> {
        const q = query(ref(database, 'confessions'), orderByChild('collegeId'), equalTo(collegeId));
        const snapshot = await get(q);
        const data = snapshotToData<Confession>(snapshot);
        return data.filter(c => !c.hidden).sort((a, b) => b.timestamp - a.timestamp);
    }

    async getConfessionsByUser(userId: string): Promise<Confession[]> {
        const q = query(ref(database, 'confessions'), orderByChild('userId'), equalTo(userId));
        const snapshot = await get(q);
        const data = snapshotToData<Confession>(snapshot);
        return data.filter(c => !c.hidden).sort((a, b) => b.timestamp - a.timestamp);
    }

    async getAllConfessions(): Promise<Confession[]> {
        const snapshot = await get(ref(database, 'confessions'));
        const data = snapshotToData<Confession>(snapshot);
        return data.sort((a, b) => b.timestamp - a.timestamp);
    }

    // --- Comments ---
    async addComment(confessionId: string, userId: string, username: string, content: string): Promise<Comment> {
        const newRef = push(ref(database, 'comments'));
        const comment: Comment = {
            id: newRef.key!,
            confessionId,
            userId,
            username,
            content,
            timestamp: Date.now()
        };
        await set(newRef, comment);
        return comment;
    }

    async getComments(confessionId: string): Promise<Comment[]> {
        const q = query(ref(database, 'comments'), orderByChild('confessionId'), equalTo(confessionId));
        const snapshot = await get(q);
        const data = snapshotToData<Comment>(snapshot);
        return data.sort((a, b) => a.timestamp - b.timestamp);
    }

    // --- Messages ---
    async sendMessage(senderId: string, receiverId: string, content: string): Promise<Message> {
        const newRef = push(ref(database, 'messages'));
        const msg: Message = {
            id: newRef.key!,
            senderId,
            receiverId,
            content,
            timestamp: Date.now(),
            read: false
        };
        await set(newRef, msg);
        await this.acceptChat(senderId, receiverId);
        return msg;
    }

    async getMessages(userId1: string, userId2: string): Promise<Message[]> {
        // In a real app, you'd want a better structure like `messages/{chatId}/{messageId}`
        // For now, we'll query all and filter (inefficient but matches current structure)
        // Optimization: Query by senderId or receiverId at least.

        const snapshot = await get(ref(database, 'messages'));
        const allMsgs = snapshotToData<Message>(snapshot);

        return allMsgs
            .filter(m => (m.senderId === userId1 && m.receiverId === userId2) || (m.senderId === userId2 && m.receiverId === userId1))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async getInbox(userId: string): Promise<{ requests: string[], accepted: string[] }> {
        const user = await this.getUser(userId);
        if (!user) return { requests: [], accepted: [] };

        // Fetch all messages involving this user
        // Again, inefficient. Better schema: `user_chats/{userId}/{chatId}`
        const snapshot = await get(ref(database, 'messages'));
        const allMsgs = snapshotToData<Message>(snapshot);
        const myMsgs = allMsgs.filter(m => m.senderId === userId || m.receiverId === userId);

        const partners = new Set<string>();
        myMsgs.forEach(m => {
            partners.add(m.senderId === userId ? m.receiverId : m.senderId);
        });

        const reqs: Set<string> = new Set();
        const accs: Set<string> = new Set();

        user.acceptedChats?.forEach(id => accs.add(id));

        partners.forEach(pid => {
            const isFollowing = user.following?.includes(pid);
            const explicit = user.acceptedChats?.includes(pid);
            const sentByMe = myMsgs.some(m => m.senderId === userId && m.receiverId === pid);

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
                acceptedChats.push(peerId);
                await update(ref(database, `users/${currentUserId}`), { acceptedChats });
            }
        }
    }

    async rejectChat(currentUserId: string, peerId: string): Promise<void> {
        // Delete messages between them
        const snapshot = await get(ref(database, 'messages'));
        const allMsgs = snapshotToData<Message>(snapshot);
        const toDelete = allMsgs.filter(m =>
            (m.senderId === currentUserId && m.receiverId === peerId) ||
            (m.senderId === peerId && m.receiverId === currentUserId)
        );

        const updates: any = {};
        toDelete.forEach(m => updates[`messages/${m.id}`] = null);
        await update(ref(database), updates);

        // Remove from accepted
        const user = await this.getUser(currentUserId);
        if (user && user.acceptedChats) {
            const acceptedChats = user.acceptedChats.filter(id => id !== peerId);
            await update(ref(database, `users/${currentUserId}`), { acceptedChats });
        }
    }

    async markAsRead(currentUserId: string, peerId: string): Promise<void> {
        const snapshot = await get(ref(database, 'messages'));
        const allMsgs = snapshotToData<Message>(snapshot);
        const unread = allMsgs.filter(m => m.receiverId === currentUserId && m.senderId === peerId && !m.read);

        if (unread.length > 0) {
            const updates: any = {};
            unread.forEach(m => updates[`messages/${m.id}/read`] = true);
            await update(ref(database), updates);
        }
    }

    async getUnreadCount(userId: string): Promise<number> {
        const snapshot = await get(ref(database, 'messages'));
        const allMsgs = snapshotToData<Message>(snapshot);
        return allMsgs.filter(m => m.receiverId === userId && !m.read).length;
    }

    async hasUnreadFrom(currentUserId: string, peerId: string): Promise<boolean> {
        const snapshot = await get(ref(database, 'messages'));
        const allMsgs = snapshotToData<Message>(snapshot);
        return allMsgs.some(m => m.receiverId === currentUserId && m.senderId === peerId && !m.read);
    }
}

export const db = new RealFirebaseService();

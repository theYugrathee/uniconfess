import React, { useState, useRef, useEffect } from 'react';
import { useSignIn, useSignUp, useClerk } from '@clerk/clerk-react';
import { User, AppView } from '../types';
import Button from './Button';
import { AppLogo } from './AppLogo';
import { db } from '../services/supabaseService';

interface AuthViewProps {
    setUser: (u: User | null) => void;
    setView: (v: AppView) => void;
    addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ setUser, setView, addToast }) => {
    // Clerk hooks for OTP verification ONLY
    const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
    const { signOut } = useClerk();

    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // OTP State
    const [verifying, setVerifying] = useState(false);
    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (verifying && otpRefs.current[0]) {
            otpRefs.current[0]?.focus();
        }
    }, [verifying]);

    const handleOtpChange = (element: HTMLInputElement, index: number) => {
        if (isNaN(Number(element.value))) return false;

        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Focus next input
        if (element.value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleAuth = async () => {
        const cleanEmail = email.trim();
        const cleanPassword = password.trim();

        if (!cleanEmail || !cleanPassword) {
            addToast('Please enter both email and password', 'error');
            return;
        }

        setLoading(true);
        try {
            if (mode === 'login') {
                // LOGIN: Use Firebase Direct (Legacy)
                const user = await db.login(cleanEmail, cleanPassword);
                if (user) {
                    addToast('Welcome back!', 'success');
                    // Explicitly set User and View for immediate feedback
                    setUser(user);
                    if (!user.username) setView(AppView.SETUP_USERNAME);
                    else if (!user.collegeId && !user.isAdmin) setView(AppView.SETUP_COLLEGE);
                    else setView(AppView.HOME);
                }
            } else {
                // SIGNUP: Use Clerk for OTP Verification FIRST
                if (!isSignUpLoaded) return;

                // 1. Create Clerk User
                await signUp.create({
                    emailAddress: cleanEmail,
                    password: cleanPassword,
                });

                // 2. Send OTP
                await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
                setVerifying(true); // Move to OTP UI
                addToast('Verification code sent to your email.', 'info');
            }
        } catch (err: any) {
            console.error("Auth error:", err);
            // Handle specific Firebase or Clerk errors
            const msg = err.message || err.errors?.[0]?.message || 'Authentication failed';

            // Helpful mapping for Firebase errors
            if (msg.includes('user-not-found')) addToast('Account not found.', 'error');
            else if (msg.includes('wrong-password')) addToast('Incorrect password.', 'error');
            else if (msg.includes('email-already-in-use')) addToast('Email already in use.', 'error');
            else addToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerification = async () => {
        if (!isSignUpLoaded) return;

        const code = otp.join("");
        if (code.length !== 6) {
            addToast('Please enter the full 6-digit code', 'error');
            return;
        }

        setLoading(true);
        let verified = false;

        try {
            const result = await signUp.attemptEmailAddressVerification({
                code,
            });

            console.log("Verification Result:", result);

            // Check if Email Verification specifically passed
            // We use 'any' cast because TS types for Clerk might be receiving updates or conflicting
            const emailStatus = (result.verifications?.emailAddress as any)?.status;

            // "verified" might not be in the strict TS enum but typically is returned.
            // Also if it returns without throwing, the CODE was correct.
            if (result.status === "complete" || emailStatus === 'verified') {
                verified = true;
            } else if (result.status === "missing_requirements") {
                // attemptEmailAddressVerification throws if the code is WRONG.
                // So if we are here, the Code was correct.
                // We can trust it for our purpose of "OTP Gate".
                verified = true;
            } else {
                addToast(`Verification Status: ${result.status}`, 'info');
            }
        } catch (err: any) {
            // ... existing catch logic ...
            console.error("Verification error:", JSON.stringify(err, null, 2));
            const msg = err.errors?.[0]?.longMessage || err.message || '';
            if (msg.includes('already been verified') || err.errors?.[0]?.code === 'verification_already_verified') {
                verified = true;
            } else {
                addToast(msg || 'Verification failed', 'error');
            }
        }

        if (verified) {
            console.log("Clerk Verified. Registering in Firebase...");
            try {
                // Try Registering - db.register typically returns void or user ref
                // We'll trust it logs us in (firebase auto-login)
                // But we need the USER object to navigate.
                // Let's try to get it or wait for AuthState, BUT for immediate nav:

                await db.register(email.trim(), password.trim());

                // Since register usually logs in, we can try fetching 'me' or just login explicitly if needed.
                // However, standard Firebase register signs you in.
                // We need the DB user specificities (which for a NEW user are empty).
                // So we can safely assume we go to SETUP_USERNAME.

                addToast('Account created! Setting up profile...', 'success');

                // Construct a temporary basic user object or just navigate
                // For safety, let's let the App.tsx listener handle the User Object hydration
                // BUT forcing the view to Setup helps the UI feel responsive.
                // Better yet, perform a quick login to get the object if register doesn't return it.

                const user = await db.login(email.trim(), password.trim());
                if (user) {
                    setUser(user);
                    setView(AppView.SETUP_USERNAME);
                }

                // Cleanup Clerk
                await signOut();
            } catch (regErr: any) {
                console.error("Firebase Registration Error:", regErr);
                if (regErr.message?.includes('email-already-in-use') || regErr.code === 'auth/email-already-in-use') {
                    // If already in Firebase, just Login
                    try {
                        const user = await db.login(email.trim(), password.trim());
                        addToast('Account Verified. Logging in...', 'success');

                        // Immediate Nav
                        if (user) {
                            setUser(user);
                            if (!user.username) setView(AppView.SETUP_USERNAME);
                            else if (!user.collegeId && !user.isAdmin) setView(AppView.SETUP_COLLEGE);
                            else setView(AppView.HOME);
                        }

                        await signOut();
                    } catch (loginErr: any) {
                        addToast('Login failed: ' + loginErr.message, 'error');
                    }
                } else {
                    addToast('Registration failed: ' + regErr.message, 'error');
                }
            }
        }

        setLoading(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !loading) {
            if (verifying) handleVerification();
            else handleAuth();
        }
    };

    if (verifying) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/5 blur-[120px] rounded-full"></div>
                <div className="w-full max-w-[400px] animate-slide-up z-10">
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-16 h-16 mb-6 rotate-1 drop-shadow-xl"><AppLogo className="w-full h-full" /></div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Verify Email</h1>
                        <p className="text-slate-400 font-medium mt-2">Enter the verification code sent to {email}</p>
                    </div>
                    <div className="premium-card p-10 rounded-[2.5rem]">
                        <div className="flex justify-center gap-2 mb-6">
                            {otp.map((data, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    inputMode="numeric"
                                    name="otp"
                                    maxLength={1}
                                    className="w-12 h-14 text-center text-2xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                                    value={data}
                                    ref={el => otpRefs.current[index] = el}
                                    onChange={e => handleOtpChange(e.target, index)}
                                    onKeyDown={e => handleKeyDown(e, index)}
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>
                        <Button className="w-full py-4 text-sm font-bold rounded-2xl shadow-glow mt-2 bg-orange-600 hover:bg-orange-700 text-white transition-all active:scale-95" onClick={handleVerification} isLoading={loading}>
                            Verify & Create Account
                        </Button>
                        <button onClick={() => setVerifying(false)} className="w-full mt-4 text-slate-400 text-sm hover:text-orange-600 transition-colors">Back</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
            {/* Sophisticated Background Decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/5 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/5 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-[400px] animate-slide-up z-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 mb-6 rotate-1 drop-shadow-xl">
                        <AppLogo className="w-full h-full" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">UniConfess</h1>
                    <p className="text-slate-400 font-medium mt-2">Campus stories, shared anonymously.</p>
                </div>

                <div className="premium-card p-10 rounded-[2.5rem]">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">{mode === 'login' ? 'Welcome Back' : 'Join Your Campus'}</h2>
                    <div className="space-y-4">
                        <div className="relative">
                            <i className="far fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <input
                                type="email"
                                placeholder="Campus Email"
                                className="premium-input pl-12"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyPress={handleKeyPress}
                                autoComplete="email"
                            />
                        </div>
                        <div className="relative">
                            <i className="fas fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <input
                                type="password"
                                placeholder="Password"
                                className="premium-input pl-12"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={handleKeyPress}
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            />
                        </div>

                        <Button
                            className="w-full py-4 text-sm font-bold rounded-2xl shadow-glow mt-4 bg-orange-600 hover:bg-orange-700 text-white transition-all active:scale-95"
                            onClick={handleAuth}
                            isLoading={loading}
                        >
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </Button>

                        <div className="mt-8 text-center">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setMode(mode === 'login' ? 'signup' : 'login');
                                    setEmail('');
                                    setPassword('');
                                }}
                                className="text-slate-400 text-sm hover:text-orange-600 transition-colors font-semibold"
                            >
                                {mode === 'login' ? <span>New here? <span className="text-orange-600 underline underline-offset-4">Create Account</span></span> : <span>Already have an account? <span className="text-orange-600 underline underline-offset-4">Login</span></span>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <p className="mt-12 text-slate-300 text-[10px] font-bold tracking-[0.2em] uppercase">Built for Campus Privacy</p>
        </div>
    );
}

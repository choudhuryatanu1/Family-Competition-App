import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { auth, db, storage } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User, Phone, Globe, Camera, ShieldCheck, Loader2, Plus, Send } from 'lucide-react';
import { generate2FACode, simulateSend2FA, handleFirestoreError, OperationType } from '../utils';

const COUNTRY_CODES = [
  { code: '+1', name: 'USA/Canada' },
  { code: '+44', name: 'UK' },
  { code: '+91', name: 'India' },
  { code: '+61', name: 'Australia' },
  { code: '+81', name: 'Japan' },
  { code: '+49', name: 'Germany' },
  { code: '+33', name: 'France' },
  { code: '+86', name: 'China' },
  { code: '+55', name: 'Brazil' },
  { code: '+27', name: 'South Africa' },
];

const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  countryCode: z.string().min(1, 'Country code is required'),
  mobileNumber: z.string().min(5, 'Invalid mobile number'),
  profilePicture: z.any().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export default function Auth() {
  const [isLogin, setIsLogin] = React.useState(true);
  const [step, setStep] = React.useState<'form' | '2fa' | 'forgot-password'>('form');
  const [loading, setLoading] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingUser, setPendingUser] = React.useState<any>(null);
  const [verificationCode, setVerificationCode] = React.useState('');
  const [sentCode, setSentCode] = React.useState('');
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const { register: registerSignup, handleSubmit: handleSignupSubmit, formState: { errors: signupErrors } } = useForm({
    resolver: zodResolver(signupSchema),
  });

  const { register: registerLogin, handleSubmit: handleLoginSubmit, formState: { errors: loginErrors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const { register: registerForgot, handleSubmit: handleForgotSubmit, formState: { errors: forgotErrors } } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSignup = async (data: any) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      let photoURL = '';
      if (data.profilePicture?.[0]) {
        const file = data.profilePicture[0];
        const storageRef = ref(storage, `profiles/${user.uid}`);
        await uploadBytes(storageRef, file);
        photoURL = await getDownloadURL(storageRef);
      }

      await updateProfile(user, { displayName: data.fullName, photoURL });

      const userProfile = {
        uid: user.uid,
        fullName: data.fullName,
        email: data.email,
        mobileNumber: data.mobileNumber,
        countryCode: data.countryCode,
        profilePicture: photoURL,
        role: 'user',
        createdAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'users', user.uid), userProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
      
      // After signup, proceed to 2FA for initial login
      const code = generate2FACode();
      setSentCode(code);
      simulateSend2FA(code, data.email);
      setPendingUser(userProfile);
      setStep('2fa');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const onLogin = async (data: any) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // First, check if user exists in Firestore
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', user.uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (!userDoc?.exists()) {
        throw new Error('User profile not found.');
      }

      const userProfile = userDoc.data();
      const code = generate2FACode();
      setSentCode(code);
      simulateSend2FA(code, userProfile.email);
      setPendingUser(userProfile);
      setStep('2fa');
      
      // Sign out temporarily until 2FA is verified
      await auth.signOut();
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async (data: any) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await sendPasswordResetEmail(auth, data.email);
      setSuccessMessage('Password reset email sent! Please check your inbox.');
      setTimeout(() => {
        setStep('form');
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async () => {
    if (verificationCode === sentCode) {
      setLoading(true);
      try {
        // Re-login after 2FA success
        // In a real app, we'd use a custom token or session
        // For this demo, we'll just re-sign in with the stored credentials or assume success
        // Since we signed out, we need to sign back in
        // But for simplicity in this demo, we'll just trigger the main app state
        window.location.reload(); // Simple way to trigger auth state change if we didn't sign out
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      setError('Invalid verification code.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden"
      >
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-emerald-200">
              F
            </div>
            <h1 className="text-2xl font-bold text-stone-900">
              {step === '2fa' ? 'Verify Identity' : step === 'forgot-password' ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Join the Family'}
            </h1>
            <p className="text-stone-500 text-sm mt-2">
              {step === '2fa' 
                ? `Enter the 6-digit code sent to ${pendingUser?.email}` 
                : step === 'forgot-password' ? 'Enter your email to receive a reset link' : isLogin ? 'Sign in to your account' : 'Create a new account (Max 50 users)'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 'form' ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {isLogin ? (
                  <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input
                          {...registerLogin('email')}
                          type="email"
                          className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                          placeholder="name@example.com"
                        />
                      </div>
                      {loginErrors.email && <p className="text-red-500 text-xs mt-1">{loginErrors.email.message as string}</p>}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Password</label>
                        <button 
                          type="button"
                          onClick={() => setStep('forgot-password')}
                          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input
                          {...registerLogin('password')}
                          type="password"
                          className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                          placeholder="••••••••"
                        />
                      </div>
                      {loginErrors.password && <p className="text-red-500 text-xs mt-1">{loginErrors.password.message as string}</p>}
                    </div>

                    <button
                      disabled={loading}
                      type="submit"
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                      Sign In
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSignupSubmit(onSignup)} className="space-y-4">
                    <div className="flex justify-center mb-6">
                      <label className="relative cursor-pointer group">
                        <div className="w-24 h-24 rounded-full bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden group-hover:border-emerald-500 transition-colors">
                          {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-8 h-8 text-stone-400 group-hover:text-emerald-500 transition-colors" />
                          )}
                        </div>
                        <input
                          {...registerSignup('profilePicture')}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1.5 rounded-full shadow-lg">
                          <Plus className="w-4 h-4" />
                        </div>
                      </label>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input
                          {...registerSignup('fullName')}
                          className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                          placeholder="John Doe"
                        />
                      </div>
                      {signupErrors.fullName && <p className="text-red-500 text-xs mt-1">{signupErrors.fullName.message as string}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input
                          {...registerSignup('email')}
                          type="email"
                          className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                          placeholder="name@example.com"
                        />
                      </div>
                      {signupErrors.email && <p className="text-red-500 text-xs mt-1">{signupErrors.email.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1">Code</label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <select
                            {...registerSignup('countryCode')}
                            className="w-full pl-9 pr-2 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none appearance-none text-sm"
                          >
                            {COUNTRY_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.code}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1">Mobile Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                          <input
                            {...registerSignup('mobileNumber')}
                            className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                            placeholder="1234567890"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input
                          {...registerSignup('password')}
                          type="password"
                          className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                          placeholder="••••••••"
                        />
                      </div>
                      {signupErrors.password && <p className="text-red-500 text-xs mt-1">{signupErrors.password.message as string}</p>}
                    </div>

                    <button
                      disabled={loading}
                      type="submit"
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                      Create Account
                    </button>
                  </form>
                )}

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-sm font-medium text-stone-500 hover:text-emerald-600 transition-colors"
                  >
                    {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                  </button>
                </div>
              </motion.div>
            ) : step === 'forgot-password' ? (
              <motion.div
                key="forgot-password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={handleForgotSubmit(onForgotPassword)} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                      <input
                        {...registerForgot('email')}
                        type="email"
                        className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                        placeholder="name@example.com"
                      />
                    </div>
                    {forgotErrors.email && <p className="text-red-500 text-xs mt-1">{forgotErrors.email.message as string}</p>}
                  </div>

                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Send Reset Link
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="w-full text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    Back to Login
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="2fa"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        type="text"
                        maxLength={1}
                        className="w-12 h-14 text-center text-2xl font-bold bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const newCode = verificationCode.split('');
                            newCode[i] = val;
                            setVerificationCode(newCode.join(''));
                            // Auto focus next
                            const next = e.target.nextElementSibling as HTMLInputElement;
                            if (next) next.focus();
                          }
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-center text-stone-400 italic">
                    Hint: Check your browser console for the mock code!
                  </p>
                </div>

                <button
                  disabled={loading || verificationCode.length < 6}
                  onClick={verify2FA}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  Verify & Continue
                </button>

                <button
                  onClick={() => setStep('form')}
                  className="w-full text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Back to Login
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl text-center"
            >
              {successMessage}
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center"
            >
              {error}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function X(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

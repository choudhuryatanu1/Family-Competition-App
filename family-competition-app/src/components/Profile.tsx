import React from 'react';
import { db, storage, auth } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion } from 'motion/react';
import { User, Mail, Phone, Globe, Calendar, Camera, Loader2, ShieldCheck, Award } from 'lucide-react';
import { format } from 'date-fns';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils';

export default function Profile({ user }: { user: any }) {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', user.uid), {
        profilePicture: photoURL
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-stone-200 shadow-xl shadow-stone-100/50 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8">
          <div className="relative group">
            <div className="w-40 h-40 rounded-[2rem] bg-stone-100 border-4 border-white shadow-xl overflow-hidden group-hover:scale-[1.02] transition-transform duration-500">
              {profile.profilePicture ? (
                <img src={profile.profilePicture} alt={profile.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400 font-black text-4xl">
                  {profile.fullName[0]}
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl shadow-lg cursor-pointer transition-all hover:scale-110">
              <Camera className="w-5 h-5" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
              <h2 className="text-4xl font-black text-stone-900 tracking-tight">{profile.fullName}</h2>
              {profile.role === 'admin' && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-widest border border-emerald-200">
                  Admin
                </span>
              )}
            </div>
            <p className="text-stone-500 font-medium mb-6 flex items-center justify-center sm:justify-start gap-2">
              <Mail className="w-4 h-4" />
              {profile.email}
            </p>
            
            <div className="flex flex-wrap justify-center sm:justify-start gap-4">
              <div className="px-6 py-3 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm border border-stone-100">
                  {profile.lastBadge || '🏆'}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Active Badge</p>
                  <p className="text-sm font-bold text-stone-900">Weekly Winner</p>
                </div>
              </div>
              <div className="px-6 py-3 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-stone-100">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Security</p>
                  <p className="text-sm font-bold text-stone-900">2FA Enabled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-stone-100 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl opacity-50" />
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border border-stone-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            Contact Information
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Mobile Number</p>
                <p className="font-bold text-stone-900">{profile.countryCode} {profile.mobileNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Country Code</p>
                <p className="font-bold text-stone-900">{profile.countryCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Member Since</p>
                <p className="font-bold text-stone-900">{format(profile.createdAt?.toDate() || new Date(), 'MMMM yyyy')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-stone-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            Achievements
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 text-center">
              <p className="text-3xl font-black text-stone-900 mb-1">0</p>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Wins</p>
            </div>
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 text-center">
              <p className="text-3xl font-black text-stone-900 mb-1">0</p>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Badges</p>
            </div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <p className="text-xs text-emerald-700 font-medium leading-relaxed">
              Keep participating in the weekly competition to earn more badges and climb the leaderboard!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

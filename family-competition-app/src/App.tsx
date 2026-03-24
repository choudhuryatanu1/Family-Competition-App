import React from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import Chat from './components/Chat';
import { Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from './utils';

export default function App() {
  const [user, setUser] = React.useState<any>(null);
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState<'dashboard' | 'leaderboard' | 'profile' | 'chat'>('dashboard');

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-stone-500 font-medium animate-pulse">Loading Family App...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Layout 
      user={userProfile} 
      onNavigate={setCurrentPage} 
      currentPage={currentPage}
    >
      {currentPage === 'dashboard' && <Dashboard user={user} />}
      {currentPage === 'leaderboard' && <Leaderboard user={user} />}
      {currentPage === 'chat' && <Chat user={user} />}
      {currentPage === 'profile' && <Profile user={user} />}
    </Layout>
  );
}

import React from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Medal, Star, Crown, Flame, Gem, Rainbow, Rocket, Clover, Pizza, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { getWeekId, getDayId, handleFirestoreError, OperationType } from '../utils';
import { Leaderboard, BADGE_OPTIONS, UserProfile } from '../types';
import { subWeeks, format, isMonday, isSunday } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function LeaderboardView({ user }: { user: any }) {
  const [currentLeaderboard, setCurrentLeaderboard] = React.useState<Leaderboard | null>(null);
  const [previousLeaderboard, setPreviousLeaderboard] = React.useState<Leaderboard | null>(null);
  const [users, setUsers] = React.useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = React.useState(true);
  const [selectingBadge, setSelectingBadge] = React.useState(false);

  const currentWeekId = getWeekId();
  const previousWeekId = getWeekId(subWeeks(new Date(), 1));

  React.useEffect(() => {
    // Fetch all users for display
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userMap: Record<string, UserProfile> = {};
      snapshot.docs.forEach(doc => {
        userMap[doc.id] = doc.data() as UserProfile;
      });
      setUsers(userMap);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    // Fetch current week entries and aggregate scores
    const qCurrent = query(collection(db, 'entries'), where('weekId', '==', currentWeekId));
    const unsubscribeCurrent = onSnapshot(qCurrent, (snapshot) => {
      const scores: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        scores[data.userId] = (scores[data.userId] || 0) + data.points;
      });
      setCurrentLeaderboard({ weekId: currentWeekId, scores });
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'entries');
    });

    // Fetch previous week leaderboard
    const unsubscribePrev = onSnapshot(doc(db, 'leaderboards', previousWeekId), (docSnap) => {
      if (docSnap.exists()) {
        setPreviousLeaderboard(docSnap.data() as Leaderboard);
      } else if (isSunday(new Date())) {
        // If it's Sunday and no leaderboard exists for last week, we might need to finalize it
        finalizePreviousWeek();
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `leaderboards/${previousWeekId}`);
    });

    setLoading(false);
    return () => {
      unsubscribeUsers();
      unsubscribeCurrent();
      unsubscribePrev();
    };
  }, [currentWeekId, previousWeekId]);

  const finalizePreviousWeek = async () => {
    try {
      const qPrev = query(collection(db, 'entries'), where('weekId', '==', previousWeekId));
      const snap = await getDocs(qPrev);
      const scores: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        scores[data.userId] = (scores[data.userId] || 0) + data.points;
      });

      // Find winner
      let winnerId = '';
      let maxScore = -1;
      Object.entries(scores).forEach(([uid, score]) => {
        if (score > maxScore) {
          maxScore = score;
          winnerId = uid;
        }
      });

      // Randomly select 5 badges for this week
      const shuffled = [...BADGE_OPTIONS].sort(() => 0.5 - Math.random());
      const availableBadges = shuffled.slice(0, 5);

      await setDoc(doc(db, 'leaderboards', previousWeekId), {
        weekId: previousWeekId,
        scores,
        winnerId,
        availableBadges,
        isFinalized: true
      });
    } catch (error) {
      console.error('Error finalizing week:', error);
    }
  };

  const selectBadge = async (badge: string) => {
    if (!previousLeaderboard || previousLeaderboard.winnerId !== user.uid) return;
    setSelectingBadge(true);
    try {
      await updateDoc(doc(db, 'leaderboards', previousWeekId), {
        winnerBadge: badge
      });
      // Also update user profile
      await updateDoc(doc(db, 'users', user.uid), {
        lastBadge: badge
      });
    } catch (error) {
      console.error('Error selecting badge:', error);
    } finally {
      setSelectingBadge(false);
    }
  };

  // Automatic Cleanup Logic (Simulated for Monday)
  React.useEffect(() => {
    if (isMonday(new Date())) {
      const cleanup = async () => {
        const lastCleanup = localStorage.getItem('last_cleanup');
        const today = getDayId();
        if (lastCleanup !== today) {
          console.log('Running Monday Cleanup...');
          const qOld = query(collection(db, 'entries'), where('weekId', '<', currentWeekId));
          const snap = await getDocs(qOld);
          const batch = writeBatch(db);
          snap.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          localStorage.setItem('last_cleanup', today);
          console.log('Cleanup complete.');
        }
      };
      cleanup();
    }
  }, [currentWeekId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const sortedCurrentScores = Object.entries(currentLeaderboard?.scores || {})
    .sort(([, a], [, b]) => (b as number) - (a as number));

  const isWinnerOfPrev = previousLeaderboard?.winnerId === user.uid && !previousLeaderboard?.winnerBadge;

  return (
    <div className="space-y-8">
      {/* Winner Announcement */}
      <AnimatePresence>
        {isWinnerOfPrev && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-3xl p-8 text-white shadow-xl shadow-amber-200 relative overflow-hidden"
          >
            <div className="relative z-10">
              <h2 className="text-amber-100 font-bold uppercase tracking-widest text-xs mb-2">Congratulations!</h2>
              <p className="text-3xl font-black tracking-tight mb-4">You won last week! 🏆</p>
              <p className="text-amber-50 mb-6 max-w-md">Select your victory badge for this week. It will be displayed on your profile!</p>
              
              <div className="flex flex-wrap gap-4">
                {previousLeaderboard?.availableBadges?.map((badge) => (
                  <button
                    key={badge}
                    onClick={() => selectBadge(badge)}
                    disabled={selectingBadge}
                    className="w-16 h-16 bg-white/20 hover:bg-white/40 rounded-2xl flex items-center justify-center text-3xl transition-all hover:scale-110 disabled:opacity-50"
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div>
            <Crown className="absolute -bottom-4 -right-4 w-48 h-48 text-white/10 rotate-12" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Leaderboard */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-stone-900 tracking-tight">Current Standings</h3>
            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full border border-emerald-100 uppercase tracking-widest">
              Week of {format(new Date(), 'MMM d')}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            {sortedCurrentScores.length === 0 ? (
              <div className="p-12 text-center">
                <Star className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                <p className="text-stone-500 font-medium">Competition has just started. Be the first to score!</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {sortedCurrentScores.map(([uid, score], index) => {
                  const profile = users[uid];
                  return (
                    <motion.div 
                      key={uid}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "flex items-center gap-4 p-6 transition-colors",
                        uid === user.uid ? "bg-emerald-50/50" : "hover:bg-stone-50"
                      )}
                    >
                      <div className="w-8 text-center font-black text-stone-300 text-lg">
                        {index + 1}
                      </div>
                      <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-stone-100 overflow-hidden border-2 border-white shadow-sm">
                          {profile?.profilePicture ? (
                            <img src={profile.profilePicture} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold">
                              {profile?.fullName?.[0]}
                            </div>
                          )}
                        </div>
                        {profile?.lastBadge && (
                          <div className="absolute -bottom-1 -right-1 bg-white rounded-full shadow-sm border border-stone-100 w-6 h-6 flex items-center justify-center text-xs">
                            {profile.lastBadge}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-stone-900">
                          {profile?.fullName || 'Unknown User'}
                          {uid === user.uid && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-widest">You</span>}
                        </p>
                        <p className="text-xs text-stone-400 font-medium">Family Member</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-stone-900">{score}</p>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Points</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Previous Week Summary */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-stone-900 tracking-tight">Last Week's Winner</h3>
          <div className="bg-stone-900 rounded-3xl p-8 text-white shadow-xl shadow-stone-200 relative overflow-hidden">
            {previousLeaderboard ? (
              <div className="relative z-10 text-center">
                <div className="w-24 h-24 rounded-3xl bg-white/10 p-1 mx-auto mb-6 relative">
                  <div className="w-full h-full rounded-2xl bg-stone-800 overflow-hidden">
                    {users[previousLeaderboard.winnerId!]?.profilePicture ? (
                      <img src={users[previousLeaderboard.winnerId!]?.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-600 font-bold text-2xl">
                        {users[previousLeaderboard.winnerId!]?.fullName?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-400 rounded-2xl flex items-center justify-center text-xl shadow-lg">
                    {previousLeaderboard.winnerBadge || '🏆'}
                  </div>
                </div>
                <h4 className="text-xl font-black mb-1">{users[previousLeaderboard.winnerId!]?.fullName || 'Family Hero'}</h4>
                <p className="text-stone-400 text-sm font-medium mb-4">Winner of Week {previousWeekId}</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold">{previousLeaderboard.scores[previousLeaderboard.winnerId!] || 0} Points</span>
                </div>
              </div>
            ) : (
              <div className="relative z-10 text-center py-8">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-stone-600" />
                </div>
                <p className="text-stone-400 text-sm font-medium">No data for previous week yet.</p>
              </div>
            )}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent)]" />
          </div>

          {/* Rules Reminder */}
          <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-stone-900 uppercase tracking-widest">Competition Rules</h4>
            <ul className="space-y-3">
              {[
                { label: 'Fruit/Veggie', pts: 5 },
                { label: 'Math Problem', pts: 5 },
                { label: 'Praying', pts: 10 },
                { label: 'Tic-Tac-Toe', pts: 10 },
                { label: 'Kindness', pts: 10 },
              ].map(rule => (
                <li key={rule.label} className="flex justify-between items-center text-xs">
                  <span className="text-stone-500 font-medium">{rule.label}</span>
                  <span className="text-emerald-600 font-bold">+{rule.pts} pts</span>
                </li>
              ))}
            </ul>
            <div className="pt-4 border-t border-stone-50">
              <p className="text-[10px] text-stone-400 italic">
                * Leaderboard resets every Sunday. Content is cleared every Monday.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

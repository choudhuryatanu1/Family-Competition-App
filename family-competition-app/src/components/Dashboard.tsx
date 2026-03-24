import React from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { 
  Apple, 
  Carrot, 
  Calculator, 
  Sparkles, 
  Gamepad2, 
  Heart, 
  Camera, 
  Send, 
  CheckCircle2, 
  Loader2,
  Trophy,
  Calendar,
  AlertCircle,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getWeekId, getDayId, getPointsForType, handleFirestoreError, OperationType } from '../utils';
import { CompetitionType, Entry, POINTS_MAP } from '../types';

const ENTRY_TYPES: { id: CompetitionType; label: string; icon: any; points: number; color: string }[] = [
  { id: 'fruit', label: 'Fruit Eaten', icon: Apple, points: 5, color: 'bg-red-50 text-red-600 border-red-100' },
  { id: 'vegetable', label: 'Vegetable Eaten', icon: Carrot, points: 5, color: 'bg-orange-50 text-orange-600 border-orange-100' },
  { id: 'math', label: 'Math Problem', icon: Calculator, points: 5, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { id: 'prayer', label: 'Praying', icon: Sparkles, points: 10, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  { id: 'tictactoe', label: 'Tic-Tac-Toe', icon: Gamepad2, points: 10, color: 'bg-purple-50 text-purple-600 border-purple-100' },
  { id: 'kindness', label: 'Kindness/Helpful', icon: Heart, points: 10, color: 'bg-pink-50 text-pink-600 border-pink-100' },
];

export default function Dashboard({ user }: { user: any }) {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<CompetitionType | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [mathProblem, setMathProblem] = React.useState({ problem: '', solution: '' });
  const [kindnessDesc, setKindnessDesc] = React.useState('');
  const [tictactoeState, setTictactoeState] = React.useState<('X' | 'O' | null)[]>(Array(9).fill(null));
  const [tictactoeWinner, setTictactoeWinner] = React.useState<'X' | 'O' | 'Draw' | null>(null);

  const weekId = getWeekId();
  const dayId = getDayId();

  React.useEffect(() => {
    const q = query(
      collection(db, 'entries'),
      where('userId', '==', user.uid),
      where('weekId', '==', weekId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Entry));
      setEntries(newEntries);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'entries');
    });

    return () => unsubscribe();
  }, [user.uid, weekId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const checkWinner = (squares: ('X' | 'O' | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (squares.every(s => s !== null)) return 'Draw';
    return null;
  };

  const handleTictactoeMove = (i: number) => {
    if (tictactoeState[i] || tictactoeWinner) return;
    const newState = [...tictactoeState];
    newState[i] = 'X';
    setTictactoeState(newState);
    const winner = checkWinner(newState);
    if (winner) {
      setTictactoeWinner(winner);
    } else {
      // Simple AI move
      setTimeout(() => {
        const emptyIndices = newState.map((v, idx) => v === null ? idx : null).filter(v => v !== null) as number[];
        if (emptyIndices.length > 0) {
          const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          newState[randomIdx] = 'O';
          setTictactoeState([...newState]);
          setTictactoeWinner(checkWinner(newState));
        }
      }, 500);
    }
  };

  const submitEntry = async () => {
    if (!selectedType) return;
    
    // Check if already submitted for this type today
    const alreadySubmitted = entries.some(e => e.type === selectedType && e.dayId === dayId);
    if (alreadySubmitted) {
      alert(`You've already submitted a ${selectedType} entry for today!`);
      return;
    }

    setLoading(true);
    try {
      let imageUrl = '';
      if (file) {
        const storageRef = ref(storage, `entries/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(storageRef);
      }

      const entry: Partial<Entry> = {
        userId: user.uid,
        type: selectedType,
        points: POINTS_MAP[selectedType],
        timestamp: serverTimestamp(),
        weekId,
        dayId,
        imageUrl,
      };

      if (selectedType === 'math') {
        entry.content = mathProblem.problem;
        entry.solution = mathProblem.solution;
      } else if (selectedType === 'kindness') {
        entry.content = kindnessDesc;
      }

      await addDoc(collection(db, 'entries'), entry);
      
      // Reset
      setSelectedType(null);
      setFile(null);
      setPreviewUrl(null);
      setMathProblem({ problem: '', solution: '' });
      setKindnessDesc('');
      setTictactoeState(Array(9).fill(null));
      setTictactoeWinner(null);
    } catch (error) {
      console.error('Error submitting entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);

  return (
    <div className="space-y-8">
      {/* Header Stat Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-emerald-100 font-medium uppercase tracking-wider text-xs mb-2">Weekly Competition</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black tracking-tighter">{totalPoints}</span>
              <span className="text-xl font-medium text-emerald-200">Points</span>
            </div>
            <p className="mt-4 text-emerald-100 text-sm max-w-xs">
              Keep it up! Every Sunday morning the leaderboard resets.
            </p>
          </div>
          <Trophy className="absolute -bottom-4 -right-4 w-48 h-48 text-white/10 rotate-12" />
        </div>

        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-stone-100 rounded-xl">
              <Calendar className="w-5 h-5 text-stone-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Current Week</p>
              <p className="text-sm font-bold text-stone-900">{weekId}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-stone-500">Weekly Goal</span>
              <span className="text-stone-900">50 Points</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((totalPoints / 50) * 100, 100)}%` }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Entry Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
          Submit Daily Entry
          <span className="text-xs font-normal text-stone-400">(One of each per day)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {ENTRY_TYPES.map((type) => {
            const isDone = entries.some(e => e.type === type.id && e.dayId === dayId);
            return (
              <button
                key={type.id}
                onClick={() => !isDone && setSelectedType(type.id)}
                disabled={isDone}
                className={cn(
                  "relative flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all group",
                  isDone 
                    ? "bg-stone-50 border-stone-100 opacity-50 cursor-not-allowed" 
                    : selectedType === type.id 
                      ? "bg-white border-emerald-500 shadow-lg shadow-emerald-100 -translate-y-1" 
                      : "bg-white border-stone-100 hover:border-stone-200 hover:-translate-y-1"
                )}
              >
                <div className={cn("p-3 rounded-2xl transition-colors", type.color)}>
                  <type.icon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-stone-900">{type.label}</p>
                  <p className="text-[10px] font-bold text-stone-400">+{type.points} pts</p>
                </div>
                {isDone && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entry Modal/Form */}
      <AnimatePresence>
        {selectedType && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-8 border border-stone-200 shadow-xl"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl", ENTRY_TYPES.find(t => t.id === selectedType)?.color)}>
                  {React.createElement(ENTRY_TYPES.find(t => t.id === selectedType)!.icon, { className: "w-6 h-6" })}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-stone-900">Submit {ENTRY_TYPES.find(t => t.id === selectedType)?.label}</h4>
                  <p className="text-sm text-stone-500">Earn {POINTS_MAP[selectedType]} points for your family!</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedType(null)}
                className="p-2 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Image Upload for most types */}
              {['fruit', 'vegetable', 'prayer', 'kindness'].includes(selectedType) && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Upload Photo</label>
                  <div 
                    onClick={() => document.getElementById('entry-photo')?.click()}
                    className="aspect-video rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all overflow-hidden"
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-stone-400 mb-2" />
                        <p className="text-sm text-stone-500 font-medium">Click to take or upload a photo</p>
                      </>
                    )}
                  </div>
                  <input 
                    id="entry-photo"
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* Math Problem Specific */}
              {selectedType === 'math' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Math Problem</label>
                    <textarea 
                      value={mathProblem.problem}
                      onChange={(e) => setMathProblem({ ...mathProblem, problem: e.target.value })}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
                      placeholder="Enter the math problem you solved..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Solution</label>
                    <textarea 
                      value={mathProblem.solution}
                      onChange={(e) => setMathProblem({ ...mathProblem, solution: e.target.value })}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
                      placeholder="Enter the solution..."
                    />
                  </div>
                </div>
              )}

              {/* Kindness Specific */}
              {selectedType === 'kindness' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">What did you do?</label>
                  <textarea 
                    value={kindnessDesc}
                    onChange={(e) => setKindnessDesc(e.target.value)}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
                    placeholder="Describe your act of kindness or help..."
                  />
                </div>
              )}

              {/* Tic-Tac-Toe Specific */}
              {selectedType === 'tictactoe' && (
                <div className="flex flex-col items-center gap-6">
                  <div className="grid grid-cols-3 gap-2 bg-stone-100 p-2 rounded-2xl">
                    {tictactoeState.map((cell, i) => (
                      <button
                        key={i}
                        onClick={() => handleTictactoeMove(i)}
                        className="w-20 h-20 bg-white rounded-xl flex items-center justify-center text-3xl font-black text-stone-900 hover:bg-stone-50 transition-colors"
                      >
                        {cell}
                      </button>
                    ))}
                  </div>
                  {tictactoeWinner && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "p-4 rounded-2xl text-center font-bold",
                        tictactoeWinner === 'X' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}
                    >
                      {tictactoeWinner === 'X' ? "You Won! 🎉" : tictactoeWinner === 'Draw' ? "It's a Draw! 🤝" : "AI Won! 🤖"}
                    </motion.div>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  disabled={loading || (selectedType === 'tictactoe' && tictactoeWinner !== 'X')}
                  onClick={submitEntry}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Submit Entry
                </button>
                <button
                  onClick={() => setSelectedType(null)}
                  className="px-8 py-4 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold rounded-2xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Entries List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-stone-900">Your Weekly Activity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200">
              <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">No entries yet this week. Start earning points!</p>
            </div>
          ) : (
            entries.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map((entry) => (
              <div key={entry.id} className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl", ENTRY_TYPES.find(t => t.id === entry.type)?.color)}>
                  {React.createElement(ENTRY_TYPES.find(t => t.id === entry.type)!.icon, { className: "w-5 h-5" })}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-stone-900">{ENTRY_TYPES.find(t => t.id === entry.type)?.label}</p>
                  <p className="text-xs text-stone-400">{format(entry.timestamp?.toDate() || new Date(), 'MMM d, h:mm a')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">+{entry.points}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

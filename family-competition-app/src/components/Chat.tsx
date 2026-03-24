import React from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, or } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Users, User, Search, Loader2, MessageSquare, ArrowLeft, Smile, Trash2 } from 'lucide-react';
import { Message, UserProfile } from '../types';
import { format, isBefore, subDays } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { writeBatch, doc, deleteDoc, getDocs } from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatProps {
  user: any;
}

type ChatTarget = {
  id: string;
  type: 'group' | 'direct';
  name: string;
  photo?: string;
};

export default function Chat({ user }: ChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [selectedTarget, setSelectedTarget] = React.useState<ChatTarget | null>({
    id: 'group',
    type: 'group',
    name: 'Family Group'
  });
  const [newMessage, setNewMessage] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const emojiPickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearOldChats = async () => {
    if (user.role !== 'admin') return;
    
    try {
      const q = query(collection(db, 'messages'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      let count = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
        // Delete if older than 24 hours
        if (timestamp && isBefore(timestamp, subDays(new Date(), 1))) {
          batch.delete(doc.ref);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        console.log(`Cleaned up ${count} old messages`);
      }
    } catch (error) {
      console.error('Error cleaning up chats:', error);
    }
  };

  React.useEffect(() => {
    if (user.role === 'admin') {
      clearOldChats();
    }
  }, [user.role]);

  React.useEffect(() => {
    // Fetch all users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userList = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.uid !== user.uid);
      setUsers(userList);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    // Fetch messages
    const q = query(
      collection(db, 'messages'),
      or(
        where('type', '==', 'group'),
        where('participants', 'array-contains', user.uid)
      ),
      orderBy('timestamp', 'asc')
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgList);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'messages');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeMessages();
    };
  }, [user.uid]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedTarget]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTarget || sending) return;

    setSending(true);
    try {
      const messageData: any = {
        senderId: user.uid,
        senderName: user.displayName || 'Unknown',
        senderPhoto: user.photoURL || '',
        text: newMessage.trim(),
        type: selectedTarget.type,
        timestamp: serverTimestamp(),
      };

      if (selectedTarget.type === 'direct') {
        messageData.receiverId = selectedTarget.id;
        messageData.participants = [user.uid, selectedTarget.id].sort();
      }

      await addDoc(collection(db, 'messages'), messageData);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const clearAllChatsAdmin = async () => {
    if (!window.confirm('Are you sure you want to delete ALL chat history? This cannot be undone.')) return;
    
    setLoading(true);
    try {
      const q = query(collection(db, 'messages'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch (error) {
      console.error('Error clearing all chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (!selectedTarget) return false;
    if (selectedTarget.type === 'group') {
      return msg.type === 'group';
    } else {
      return msg.type === 'direct' && msg.participants?.includes(selectedTarget.id);
    }
  });

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col lg:flex-row h-[700px]">
      {/* Sidebar */}
      <div className={cn(
        "w-full lg:w-80 border-r border-stone-100 flex flex-col",
        selectedTarget && "hidden lg:flex"
      )}>
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <h3 className="text-xl font-black text-stone-900">Messages</h3>
          {user.role === 'admin' && (
            <button
              onClick={clearAllChatsAdmin}
              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
              title="Clear All Chat History"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="p-4 border-b border-stone-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search family..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={() => setSelectedTarget({ id: 'group', type: 'group', name: 'Family Group' })}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-2xl transition-all",
              selectedTarget?.id === 'group' ? "bg-emerald-50 text-emerald-700" : "hover:bg-stone-50 text-stone-600"
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Family Group</p>
              <p className="text-xs opacity-70">Shared family chat</p>
            </div>
          </button>

          <div className="px-3 py-2">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Direct Messages</p>
          </div>

          {filteredUsers.map(u => (
            <button
              key={u.uid}
              onClick={() => setSelectedTarget({ id: u.uid, type: 'direct', name: u.fullName, photo: u.profilePicture })}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-2xl transition-all",
                selectedTarget?.id === u.uid ? "bg-emerald-50 text-emerald-700" : "hover:bg-stone-50 text-stone-600"
              )}
            >
              <div className="w-12 h-12 rounded-xl bg-stone-100 overflow-hidden border border-stone-200">
                {u.profilePicture ? (
                  <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold">
                    {u.fullName[0]}
                  </div>
                )}
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">{u.fullName}</p>
                <p className="text-xs opacity-70">Family Member</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-stone-50/30",
        !selectedTarget && "hidden lg:flex"
      )}>
        {selectedTarget ? (
          <>
            {/* Header */}
            <div className="p-4 lg:p-6 bg-white border-b border-stone-100 flex items-center gap-4">
              <button 
                onClick={() => setSelectedTarget(null)}
                className="lg:hidden p-2 hover:bg-stone-100 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5 text-stone-600" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-stone-100 overflow-hidden border border-stone-200">
                {selectedTarget.type === 'group' ? (
                  <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Users className="w-5 h-5" />
                  </div>
                ) : selectedTarget.photo ? (
                  <img src={selectedTarget.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold">
                    {selectedTarget.name[0]}
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-bold text-stone-900">{selectedTarget.name}</h4>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                  {selectedTarget.type === 'group' ? 'Group Chat' : 'Direct Message'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4"
            >
              {filteredMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2">
                  <MessageSquare className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">No messages yet. Say hello!</p>
                </div>
              ) : (
                filteredMessages.map((msg, i) => {
                  const isMe = msg.senderId === user.uid;
                  const showSender = selectedTarget.type === 'group' && !isMe;
                  
                  return (
                    <motion.div
                      key={msg.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex flex-col",
                        isMe ? "items-end" : "items-start"
                      )}
                    >
                      {showSender && (
                        <span className="text-[10px] font-bold text-stone-400 ml-1 mb-1 uppercase tracking-widest">
                          {msg.senderName}
                        </span>
                      )}
                      <div className={cn(
                        "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                        isMe 
                          ? "bg-emerald-600 text-white rounded-tr-none" 
                          : "bg-white text-stone-800 border border-stone-100 rounded-tl-none"
                      )}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-stone-400 mt-1 mx-1">
                        {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'h:mm a') : '...'}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 lg:p-6 bg-white border-t border-stone-100 relative">
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div 
                    ref={emojiPickerRef}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full right-4 mb-4 z-50"
                  >
                    <EmojiPicker 
                      onEmojiClick={onEmojiClick}
                      theme={Theme.LIGHT}
                      width={300}
                      height={400}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 transition-colors",
                      showEmojiPicker ? "text-emerald-600" : "text-stone-400 hover:text-stone-600"
                    )}
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                <button
                  disabled={!newMessage.trim() || sending}
                  type="submit"
                  className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400 space-y-4">
            <div className="w-20 h-20 bg-stone-100 rounded-3xl flex items-center justify-center">
              <MessageSquare className="w-10 h-10 opacity-20" />
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-stone-900">Your Conversations</p>
              <p className="text-sm">Select a family member to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

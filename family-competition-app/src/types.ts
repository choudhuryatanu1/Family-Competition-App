export type CompetitionType = 'fruit' | 'vegetable' | 'math' | 'prayer' | 'tictactoe' | 'kindness';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  countryCode: string;
  profilePicture?: string;
  role: 'user' | 'admin';
  lastBadge?: string;
  createdAt: any;
}

export interface Entry {
  id?: string;
  userId: string;
  type: CompetitionType;
  points: number;
  content?: string;
  solution?: string;
  imageUrl?: string;
  timestamp: any;
  weekId: string;
  dayId: string;
}

export interface Leaderboard {
  weekId: string;
  scores: Record<string, number>;
  winnerId?: string;
  winnerBadge?: string;
  availableBadges?: string[];
  isFinalized?: boolean;
}

export interface Message {
  id?: string;
  senderId: string;
  receiverId?: string; // userId for direct message, undefined for group
  type: 'group' | 'direct';
  text: string;
  timestamp: any;
  senderName: string;
  senderPhoto?: string;
  participants?: string[]; // [uid1, uid2] for direct messages
}

export const POINTS_MAP: Record<CompetitionType, number> = {
  fruit: 5,
  vegetable: 5,
  math: 5,
  prayer: 10,
  tictactoe: 10,
  kindness: 10,
};

export const BADGE_OPTIONS = ['🏆', '🥇', '🌟', '👑', '🔥', '💎', '🌈', '🚀', '🍀', '🍕'];

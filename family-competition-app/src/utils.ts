import { startOfWeek, endOfWeek, format } from 'date-fns';
import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const getWeekId = (date: Date = new Date()) => {
  const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday
  return format(start, 'yyyy-MM-dd');
};

export const getDayId = (date: Date = new Date()) => {
  return format(date, 'yyyy-MM-dd');
};

export const isCompetitionActive = (date: Date = new Date()) => {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return date >= start && date <= end;
};

export const generate2FACode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const simulateSend2FA = (code: string, to: string) => {
  console.log(`[SIMULATION] Sending 2FA code ${code} to ${to}`);
  // In a real app, this would call an API to send SMS or Email.
  // For this demo, we'll just show it in the UI or console.
};

export const getPointsForType = (type: string): number => {
  switch (type) {
    case 'fruit':
    case 'vegetable':
    case 'math':
      return 5;
    case 'prayer':
    case 'tictactoe':
    case 'kindness':
      return 10;
    default:
      return 0;
  }
};

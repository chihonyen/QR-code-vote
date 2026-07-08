import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  Timestamp,
  updateDoc,
  onSnapshot
} from "firebase/firestore";
import { getAuth, signInAnonymously, User } from "firebase/auth";
import { Poll, Vote } from "../types";

import firebaseAppletConfig from "../../firebase-applet-config.json";

// Firebase Config from environment variables or firebase-applet-config.json
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig?.apiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig?.authDomain || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig?.projectId || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig?.storageBucket || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig?.messagingSenderId || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig?.appId || "",
  firestoreDatabaseId: firebaseAppletConfig?.firestoreDatabaseId || ""
};

// Check if valid Firebase configuration is present
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.authDomain
);

let db: any = null;
let auth: any = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const dbId = firebaseConfig.firestoreDatabaseId;
    db = dbId && dbId !== "(default)" ? getFirestore(app, dbId) : getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase initialization failed, falling back to Simulation mode:", error);
  }
}

// ==========================================
// ANONYMOUS AUTH UTILS
// ==========================================

export interface MockUser {
  uid: string;
  isAnonymous: boolean;
}

export async function getAnonymousUser(): Promise<MockUser | User> {
  if (isFirebaseConfigured && auth) {
    try {
      const userCredential = await signInAnonymously(auth);
      return userCredential.user;
    } catch (err) {
      console.warn("Firebase Anonymous Sign-in failed. Falling back to local ID.", err);
    }
  }

  // Fallback to local anonymous UID saved in localStorage
  let localUid = localStorage.getItem("secure_voter_uid");
  if (!localUid) {
    localUid = "anon_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("secure_voter_uid", localUid);
  }
  return {
    uid: localUid,
    isAnonymous: true
  };
}

// ==========================================
// LOCAL STORAGE SIMULATION DB FOR PREVIEW
// ==========================================

const LOCAL_POLLS_KEY = "secure_vote_polls";
const LOCAL_VOTES_KEY_PREFIX = "secure_vote_votes_";

function getLocalPolls(): Record<string, Poll> {
  const data = localStorage.getItem(LOCAL_POLLS_KEY);
  return data ? JSON.parse(data) : {};
}

function saveLocalPolls(polls: Record<string, Poll>) {
  localStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(polls));
}

function getLocalVotes(pollId: string): Vote[] {
  const data = localStorage.getItem(`${LOCAL_VOTES_KEY_PREFIX}${pollId}`);
  return data ? JSON.parse(data) : [];
}

function saveLocalVotes(pollId: string, votes: Vote[]) {
  localStorage.setItem(`${LOCAL_VOTES_KEY_PREFIX}${pollId}`, JSON.stringify(votes));
}

// ==========================================
// CORE DB INTERFACES (ABSTRACTED)
// ==========================================

/**
 * Creates a new voting poll
 */
export async function createPollInDB(pollData: Omit<Poll, "id" | "createdAt">): Promise<string> {
  const pollId = Math.random().toString(36).substring(2, 11).toUpperCase(); // Custom easy-to-read ID (e.g. 9 characters)
  const createdAt = Date.now();

  const fullPoll: Poll = {
    ...pollData,
    id: pollId,
    createdAt
  };

  if (isFirebaseConfigured && db) {
    try {
      const pollRef = doc(collection(db, "polls"), pollId);
      await setDoc(pollRef, {
        title: fullPoll.title,
        description: fullPoll.description || "",
        options: fullPoll.options,
        createdAt: Timestamp.fromMillis(createdAt),
        expiresAt: Timestamp.fromMillis(fullPoll.expiresAt),
        creatorUid: fullPoll.creatorUid || "",
        maxChoices: fullPoll.maxChoices || 1
      });
      return pollId;
    } catch (error) {
      console.error("Firestore write failed:", error);
      throw error;
    }
  }

  // Fallback Simulation Mode
  const polls = getLocalPolls();
  polls[pollId] = fullPoll;
  saveLocalPolls(polls);
  return pollId;
}

/**
 * Retrieves a poll by ID
 */
export async function getPollFromDB(pollId: string): Promise<Poll | null> {
  if (isFirebaseConfigured && db) {
    try {
      const pollRef = doc(db, "polls", pollId);
      const pollSnap = await getDoc(pollRef);
      if (pollSnap.exists()) {
        const data = pollSnap.data();
        return {
          id: pollSnap.id,
          title: data.title,
          description: data.description,
          options: data.options,
          createdAt: data.createdAt.toMillis(),
          expiresAt: data.expiresAt.toMillis(),
          creatorUid: data.creatorUid,
          maxChoices: data.maxChoices || 1
        };
      }
      return null;
    } catch (error) {
      console.error("Firestore read failed:", error);
      throw error;
    }
  }

  // Fallback Simulation Mode
  const polls = getLocalPolls();
  return polls[pollId] || null;
}

/**
 * Closes/Ends a poll manually by setting its expiresAt to a past timestamp
 */
export async function closePollInDB(pollId: string): Promise<void> {
  const expiresAt = Date.now() - 1000;

  if (isFirebaseConfigured && db) {
    try {
      const pollRef = doc(db, "polls", pollId);
      await updateDoc(pollRef, {
        expiresAt: Timestamp.fromMillis(expiresAt)
      });
      return;
    } catch (error) {
      console.error("Firestore poll update failed:", error);
      throw error;
    }
  }

  // Fallback Simulation Mode
  const polls = getLocalPolls();
  if (polls[pollId]) {
    polls[pollId].expiresAt = expiresAt;
    saveLocalPolls(polls);
  }
}

/**
 * Submits a vote to a specific poll
 */
export async function castVoteInDB(pollId: string, voterUid: string, optionIndex: number, optionIndices?: number[]): Promise<void> {
  const poll = await getPollFromDB(pollId);
  if (!poll) throw new Error("找不到投票項目。");

  if (Date.now() > poll.expiresAt) {
    throw new Error("此投票已截止，無法再進行投票。");
  }

  const indices = optionIndices || [optionIndex];

  if (isFirebaseConfigured && db) {
    // Structure: polls/{pollId}/votes/{voterUid}
    const voteRef = doc(db, "polls", pollId, "votes", voterUid);
    
    // Check if user has already voted
    const voteSnap = await getDoc(voteRef);
    if (voteSnap.exists()) {
      throw new Error("您在該項目中已經投過票了，無法重複投票！");
    }

    try {
      await setDoc(voteRef, {
        optionIndex,
        optionIndices: indices,
        votedAt: Timestamp.now()
      });
      return;
    } catch (error: any) {
      console.error("Firestore vote failed:", error);
      throw new Error("雲端投票提交失敗：" + (error.message || error));
    }
  } else {
    // Fallback Simulation Mode
    const localVotes = getLocalVotes(pollId);
    const existingVote = localVotes.find(v => v.voterUid === voterUid);
    if (existingVote) {
      throw new Error("您在該項目中已經投過票了，無法重複投票！");
    }

    localVotes.push({
      voterUid,
      optionIndex,
      optionIndices: indices,
      votedAt: Date.now()
    });
    saveLocalVotes(pollId, localVotes);
  }
}

/**
 * Retrieves all votes for a poll to build counting charts
 */
export async function getVotesFromDB(pollId: string): Promise<Vote[]> {
  if (isFirebaseConfigured && db) {
    try {
      const votesColRef = collection(db, "polls", pollId, "votes");
      const votesSnap = await getDocs(votesColRef);
      const list: Vote[] = [];
      votesSnap.forEach((d) => {
        const data = d.data();
        list.push({
          voterUid: d.id,
          optionIndex: data.optionIndex,
          optionIndices: data.optionIndices || (data.optionIndex !== undefined ? [data.optionIndex] : []),
          votedAt: data.votedAt?.toMillis() || Date.now()
        });
      });
      return list;
    } catch (error) {
      console.error("Firestore votes fetch failed:", error);
      throw error;
    }
  }

  // Fallback Simulation Mode
  return getLocalVotes(pollId);
}

/**
 * Subscribes to votes of a poll in real-time
 */
export function subscribeToVotes(pollId: string, callback: (votes: Vote[]) => void): () => void {
  if (isFirebaseConfigured && db) {
    const votesColRef = collection(db, "polls", pollId, "votes");
    return onSnapshot(votesColRef, (snapshot) => {
      const list: Vote[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          voterUid: d.id,
          optionIndex: data.optionIndex,
          optionIndices: data.optionIndices || (data.optionIndex !== undefined ? [data.optionIndex] : []),
          votedAt: data.votedAt?.toMillis() || Date.now()
        });
      });
      callback(list);
    }, (error) => {
      console.error("Firestore real-time subscription error:", error);
    });
  }

  // Fallback Simulation Mode - poll local storage
  const interval = setInterval(() => {
    callback(getLocalVotes(pollId));
  }, 2000);
  return () => clearInterval(interval);
}

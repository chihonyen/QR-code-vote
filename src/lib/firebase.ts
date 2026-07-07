import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  Timestamp,
  updateDoc
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
        creatorUid: fullPoll.creatorUid || ""
      });
      return pollId;
    } catch (error) {
      console.error("Firestore write failed, using local simulation instead:", error);
    }
  }

  // Fallback
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
          creatorUid: data.creatorUid
        };
      }
    } catch (error) {
      console.error("Firestore read failed, searching local storage:", error);
    }
  }

  // Fallback
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
      console.error("Firestore poll update failed, using local storage simulation:", error);
    }
  }

  // Fallback
  const polls = getLocalPolls();
  if (polls[pollId]) {
    polls[pollId].expiresAt = expiresAt;
    saveLocalPolls(polls);
  }
}

/**
 * Submits a vote to a specific poll
 */
export async function castVoteInDB(pollId: string, voterUid: string, optionIndex: number): Promise<void> {
  const poll = await getPollFromDB(pollId);
  if (!poll) throw new Error("Poll not found.");

  if (Date.now() > poll.expiresAt) {
    throw new Error("This poll has already expired and is closed for voting.");
  }

  if (isFirebaseConfigured && db) {
    try {
      // Structure: polls/{pollId}/votes/{voterUid}
      const voteRef = doc(db, "polls", pollId, "votes", voterUid);
      
      // Check if user has already voted
      const voteSnap = await getDoc(voteRef);
      if (voteSnap.exists()) {
        throw new Error("You have already voted in this poll. Your vote is locked.");
      }

      await setDoc(voteRef, {
        optionIndex,
        votedAt: Timestamp.now()
      });
      return;
    } catch (error: any) {
      if (error.message && error.message.includes("permission-denied")) {
        throw new Error("Security rule rejection: You cannot vote twice or modify cast votes.");
      }
      console.error("Firestore vote failed, attempting simulation:", error);
    }
  }

  // Fallback
  const localVotes = getLocalVotes(pollId);
  const existingVote = localVotes.find(v => v.voterUid === voterUid);
  if (existingVote) {
    throw new Error("You have already voted in this poll. Your vote is locked.");
  }

  localVotes.push({
    voterUid,
    optionIndex,
    votedAt: Date.now()
  });
  saveLocalVotes(pollId, localVotes);
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
          votedAt: data.votedAt?.toMillis() || Date.now()
        });
      });
      return list;
    } catch (error) {
      console.error("Firestore votes fetch failed, reading from simulation:", error);
    }
  }

  // Fallback
  return getLocalVotes(pollId);
}

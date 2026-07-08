export interface Poll {
  id: string;
  title: string;
  description?: string;
  options: string[];
  createdAt: number; // UTC timestamp (ms)
  expiresAt: number; // UTC timestamp (ms)
  creatorUid?: string;
  maxChoices?: number; // Maximum options a user can select (defaults to 1)
}

export interface Vote {
  voterUid: string;
  optionIndex?: number; // fallback for single vote
  optionIndices?: number[]; // list of selected option indices (for multiple choices)
  votedAt: number; // UTC timestamp (ms)
}

export interface PollResults {
  poll: Poll;
  votes: Vote[];
  totalVotes: number;
  optionCounts: { [index: number]: number };
  optionPercentages: { [index: number]: number };
}

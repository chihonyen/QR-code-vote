export interface Poll {
  id: string;
  title: string;
  description?: string;
  options: string[];
  createdAt: number; // UTC timestamp (ms)
  expiresAt: number; // UTC timestamp (ms)
  creatorUid?: string;
}

export interface Vote {
  voterUid: string;
  optionIndex: number;
  votedAt: number; // UTC timestamp (ms)
}

export interface PollResults {
  poll: Poll;
  votes: Vote[];
  totalVotes: number;
  optionCounts: { [index: number]: number };
  optionPercentages: { [index: number]: number };
}

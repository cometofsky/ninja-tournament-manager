import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  round: { type: Number, required: true },
  matchNumber: { type: Number, required: true },
  player1: { type: String, default: null },
  player2: { type: String, default: null },
  player1Score: { type: Number, default: null },
  player2Score: { type: Number, default: null },
  winner: { type: String, default: null },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  stageType: { type: String, enum: ['group', 'round-robin', 'knockout', 'semifinal', 'final'], default: 'knockout' },
  groupId: { type: String, default: null },
}, { _id: false });

const groupSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  name: { type: String, required: true },
  players: [String],
  round: { type: Number, required: true },
}, { _id: false });

const standingSchema = new mongoose.Schema({
  player: { type: String, required: true },
  played: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  goalsFor: { type: Number, default: 0 },
  goalsAgainst: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  groupId: { type: String, default: null },
}, { _id: false });

const renameHistorySchema = new mongoose.Schema({
  oldName: { type: String, required: true },
  newName: { type: String, required: true },
  renamedAt: { type: Date, default: Date.now },
  renamedBy: { type: String, default: null },
}, { _id: false });

const stageSchema = new mongoose.Schema({
  stageNumber: { type: Number, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['round-robin', 'group', 'knockout'], required: true },
  round: { type: Number, required: true },
  players: [String],
  groups: [groupSchema],
  playerCount: { type: Number },
  advancingCount: { type: Number },
  status: {
    type: String,
    enum: ['pending', 'active', 'awaiting-next-format', 'completed'],
    default: 'pending',
  },
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  players: [{ type: String }],
  initialFormat: { type: String, enum: ['round-robin', 'group'], required: true },
  numberOfGroups: { type: Number, default: null },
  status: { type: String, enum: ['setup', 'in-progress', 'completed'], default: 'in-progress' },
  currentStageIndex: { type: Number, default: 0 },
  stages: [stageSchema],
  matches: [matchSchema],
  standings: [standingSchema],
  renameHistory: [renameHistorySchema],
  tieBreaks: [{
    stageNumber: Number,
    groupId: String,
    candidates: [String],
    requiredCount: Number,
    resolved: { type: Boolean, default: false },
    selected: [String],
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  champion: { type: String, default: null },
});

// Prevent model re-registration in Next.js hot-reload
export default mongoose.models.Tournament || mongoose.model('Tournament', tournamentSchema);

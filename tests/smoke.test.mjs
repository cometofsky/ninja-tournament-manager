// Smoke tests for the pure tournament logic in src/lib/tournament.js.
// Run: npm test  (node --test tests/)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRoundRobinMatches,
  buildGroupStandings,
  sortStandings,
} from '../src/lib/tournament.js';

test('round-robin: every pair meets exactly once, including odd player count (BYE)', () => {
  const players = ['A', 'B', 'C', 'D', 'E']; // odd → BYE padding
  const matches = generateRoundRobinMatches(players, 1, 'round-robin', null, 1);

  // C(5,2) = 10 real matches, no BYE leaks
  assert.equal(matches.length, 10);
  const pairs = new Set(matches.map(m => [m.player1, m.player2].sort().join('-')));
  assert.equal(pairs.size, 10);
  for (const m of matches) {
    assert.notEqual(m.player1, 'BYE');
    assert.notEqual(m.player2, 'BYE');
  }
  // Match numbers are sequential from startMn
  assert.deepEqual(matches.map(m => m.matchNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('standings: points, abandoned penalty, and goal-difference tiebreak', () => {
  const matches = [
    { player1: 'A', player2: 'B', player1Score: 3, player2Score: 0, status: 'completed' },
    { player1: 'B', player2: 'C', player1Score: 1, player2Score: 1, status: 'completed' },
    { player1: 'A', player2: 'C', status: 'abandoned' }, // -2 points each
  ];
  const table = sortStandings(buildGroupStandings(matches, ['A', 'B', 'C'], 'G1'));
  const byName = Object.fromEntries(table.map(s => [s.player, s]));

  assert.equal(byName.A.points, 1); // 3 (win) - 2 (abandoned)
  assert.equal(byName.B.points, 1); // 0 (loss) + 1 (draw)
  assert.equal(byName.C.points, -1); // 1 (draw) - 2 (abandoned)

  // A and B tied on points → A first on goal difference (+3 vs -2)
  assert.deepEqual(table.map(s => s.player), ['A', 'B', 'C']);
});

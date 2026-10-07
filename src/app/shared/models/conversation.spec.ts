import { reactionCount, updateReactionCounts } from './conversation';

describe('Reaction aggregates', (): void => {
  it('adds, changes, and removes one reaction without mutating input', (): void => {
    const initial = { useful: 10, agree: 20 };
    const added = updateReactionCounts(initial, null, 'useful');
    expect(added).toEqual({ useful: 11, agree: 20 });
    const changed = updateReactionCounts(added, 'useful', 'agree');
    expect(changed).toEqual({ useful: 10, agree: 21 });
    expect(updateReactionCounts(changed, 'agree', null)).toEqual(initial);
    expect(initial).toEqual({ useful: 10, agree: 20 });
  });

  it('never creates negative counts or accepts invalid aggregates', (): void => {
    expect(reactionCount({ useful: NaN }, 'useful')).toBe(0);
    expect(updateReactionCounts({}, 'useful', null)).toEqual({ useful: 0 });
    const counts = { useful: 10 };
    expect(updateReactionCounts(counts, 'useful', 'useful')).toBe(counts);
  });
});

import { Component, computed, input } from '@angular/core';
import {
  REACTION_TYPES,
  ReactionCounts,
  ReactionId,
  reactionCount,
} from '../../models/conversation';
import { Icon } from '../../ui/icon/icon';

interface RankedReaction {
  readonly id: ReactionId;
  readonly count: number;
  readonly label: string;
  readonly icon: (typeof REACTION_TYPES)[number]['icon'];
}

/**
 * Orders reaction marks by descending count; stable ties retain vocabulary order.
 *
 * @param left First reaction aggregate.
 * @param right Second reaction aggregate.
 * @returns Comparator result.
 */
function compareCounts(left: RankedReaction, right: RankedReaction): number {
  return right.count - left.count;
}

@Component({
  imports: [Icon],
  selector: 'app-reaction-summary',
  templateUrl: './reaction-summary.html',
})
export class ReactionSummary {
  readonly counts = input<ReactionCounts>({});
  protected readonly summary = computed(this.summarize.bind(this));

  /**
   * Aggregates normalized counts and the three most frequent reaction marks.
   *
   * @returns Total, marks, and a complete accessible description.
   */
  private summarize(): { total: number; top: RankedReaction[]; label: string } {
    const ranked: RankedReaction[] = [];
    const labels: string[] = [];
    let total = 0;
    for (const type of REACTION_TYPES) {
      const count = reactionCount(this.counts(), type.id);
      if (count) {
        total += count;
        ranked.push({ ...type, count });
        labels.push(type.label + ': ' + count);
      }
    }
    return {
      total,
      top: ranked.sort(compareCounts).slice(0, 3),
      label: total + (total === 1 ? ' reaction. ' : ' reactions. ') + labels.join(', '),
    };
  }
}

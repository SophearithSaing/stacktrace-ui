import { AGENTS, AgentId, AgentTheme } from '../ui/avatar/agents';

/** Presentation metadata; the account ID is independent of its visual theme. */
export interface AccountIdentity {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly handle: string;
  readonly status: string;
  readonly verified: boolean;
  readonly type: 'human' | 'agent';
  readonly theme: AgentTheme;
}

/**
 * Checks a local demo/theme key without trusting arbitrary server strings.
 * @param id Candidate registered key.
 * @returns Whether the key exists in the local registry.
 */
export function isAgentId(id: string): id is AgentId {
  return Object.hasOwn(AGENTS, id);
}

/**
 * Adapts legacy specimens or returns neutral metadata for an unknown ID.
 * @param id Canonical account ID or local demo key.
 * @param account Optional explicit presentation metadata.
 * @returns Display identity, without interpreting the ID as a CSS theme.
 */
export function resolveIdentity(id: string, account?: AccountIdentity): AccountIdentity {
  if (account) {
    return account;
  }
  const demo = isAgentId(id) ? AGENTS[id] : undefined;
  return {
    id,
    name: demo?.name ?? 'Unknown account',
    initials: demo?.initials ?? '?',
    handle: demo?.handle ?? '',
    status: '',
    verified: !!demo && id !== 'observer',
    type: id === 'observer' || !demo ? 'human' : 'agent',
    theme: isAgentId(id) ? id : 'observer',
  };
}

export const AGENTS = {
  observer: { name: 'You', initials: 'Y', handle: '@human_observer' },
  postgres: { name: 'PostgreSQL', initials: 'PG', handle: '@postgres' },
  angular: { name: 'Angular', initials: 'NG', handle: '@angular' },
  typescript: { name: 'TypeScript', initials: 'TS', handle: '@typescript' },
  mongodb: { name: 'MongoDB', initials: 'MG', handle: '@mongodb' },
  docker: { name: 'Docker', initials: 'DK', handle: '@docker' },
  rust: { name: 'Rust', initials: 'RS', handle: '@rustlang' },
  redis: { name: 'Redis', initials: 'RD', handle: '@redis' },
  kubernetes: { name: 'Kubernetes', initials: 'K8', handle: '@kubernetes' },
} as const;

export type AgentId = keyof typeof AGENTS;
export type AvatarSize = 'standard' | 'quote' | 'reply' | 'suggestion' | 'profile';

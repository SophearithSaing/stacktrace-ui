import { AgentTheme } from './agents';

/** Local artwork/text, never a field supplied by the API. */
export const PROFILE_MOTIFS: Readonly<Record<AgentTheme, string>> = {
  postgres: 'SELECT * FROM better_decisions;',
  angular: 'THE PLATFORM FOR AMBITIOUS APPS',
  typescript: 'type BetterWeb = Known & Reliable;',
  mongodb: "{ ideas: { shape: 'flexible' } }",
  docker: 'BUILD  SHIP  RUN',
  rust: 'fearless_concurrency::spawn()',
  redis: 'GET perspective // 0.2ms',
  kubernetes: 'READY  200/200  DESIRED',
  observer: 'Still learning. Still listening.',
};

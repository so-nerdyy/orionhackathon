export interface Agent {
  id: string;
  type: AgentType;
  x: number;
  y: number;
}

export type AgentType = 'Researcher' | 'Critic' | 'Synthesizer' | 'Coder' | 'Validator';

export interface AgentDefinition {
  type: AgentType;
  name: string;
  description: string;
  icon: string;
}

export type ConnectionType = 'sequential' | 'parallel' | 'feedback';

export interface Connection {
  id: string;
  from: string;
  to: string;
  type: ConnectionType;
}

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  { type: 'Researcher', name: 'Researcher', description: 'Searches & gathers info', icon: '🔍' },
  { type: 'Critic', name: 'Critic', description: 'Evaluates & reviews', icon: '👁️' },
  { type: 'Synthesizer', name: 'Synthesizer', description: 'Combines & summarizes', icon: '🧩' },
  { type: 'Coder', name: 'Coder', description: 'Writes & implements code', icon: '💻' },
  { type: 'Validator', name: 'Validator', description: 'Tests & validates', icon: '✓' },
];
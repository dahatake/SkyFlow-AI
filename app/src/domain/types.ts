export type FlightStatus = 'Scheduled' | 'Inbound' | 'Arrived' | 'Turnaround' | 'Ready' | 'Departed' | 'Delayed' | 'Cancelled';
export type TurnaroundState = 'NotStarted' | 'Active' | 'AtRisk' | 'Blocked' | 'Complete';
export type TaskState = 'Planned' | 'Ready' | 'InProgress' | 'AtRisk' | 'Blocked' | 'Complete';
export type AssetState = 'Available' | 'Reserved' | 'Engaged' | 'Unavailable' | 'Unknown';
export type ExceptionState = 'New' | 'Acknowledged' | 'Assigned' | 'Monitoring' | 'Resolved';
export type SlaLevel = 'Normal' | 'Watch' | 'AtRisk' | 'Breach';
export type ScenarioState = 'Draft' | 'Valid' | 'Active' | 'Inactive';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export const SLA_ORDER: SlaLevel[] = ['Normal', 'Watch', 'AtRisk', 'Breach'];
export const SEVERITY_ORDER: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export type RoleType = 'Control Tower Lead' | 'SIOC Duty Manager' | 'BU Ops Manager' | 'Ramp Lead' | 'Action Owner' | 'Observer';
export const ROLES: RoleType[] = ['Control Tower Lead', 'SIOC Duty Manager', 'BU Ops Manager', 'Ramp Lead', 'Action Owner', 'Observer'];

export interface Airline { id: string; code: string; name: string; slaProfileId: string }
export interface BusinessUnit { id: string; name: string; scope: string }
export interface Stakeholder { id: string; displayName: string; roleType: RoleType; buId: string; scope: string }
export interface Stand { id: string; pier: string; stand: string; x: number; y: number; status: 'Open' | 'Occupied' | 'Closed' }
export interface Flight {
  id: string; flightNo: string; airlineId: string; origin: string; destination: string;
  sta: number; ata?: number; std: number; etd: number; status: FlightStatus; pierId: string; standId: string;
}
export interface Turnaround {
  id: string; flightId: string; plannedStart: number; plannedEnd: number; actualStart?: number; phase: TurnaroundState;
  health: SlaLevel; slaRisk: SlaLevel;
}
export interface Milestone {
  id: string; turnaroundId: string; type: string; plannedTime: number; forecastTime: number; actualTime?: number; status: TaskState;
}
export interface Task {
  id: string; turnaroundId: string; taskType: string; ownerId: string; buId: string; status: TaskState;
  plannedTime: number; forecastTime: number; actualTime?: number; priority: 1 | 2 | 3; assetId?: string;
}
export interface StaffCapacity { id: string; buId: string; skillGroup: string; planned: number; available: number; engaged: number; windowStart: number; windowEnd: number }
export interface Asset { id: string; type: string; status: AssetState; standId: string; assignedTaskId?: string; availFrom: number; availTo: number }
export interface SlaRule { id: string; airlineId: string; milestoneType: string; targetMin: number; toleranceMin: number; priority: number }
export interface SlaRisk { id: string; ruleId: string; affectedEntityId: string; level: SlaLevel; cause: string; forecastBreach?: number }
export interface OpException {
  id: string; type: string; severity: Severity; detectedAt: number; source: string; status: ExceptionState;
  ownerId?: string; affectedEntityIds: string[]; explanation: string; nextAction: string; targetTime: number;
}
export interface ActionItem {
  id: string; exceptionId?: string; taskId?: string; ownerId?: string; leadStakeholderId: string; status: ExceptionState; targetTime: number; audit: string[];
}
export interface Constraint { id: string; type: string; scope: string; start: number; end: number; severity: Severity; source: string; sourceTime: number }

export interface Baseline {
  schemaVersion: number; seedVersion: string; now: number;
  airlines: Airline[]; bus: BusinessUnit[]; stakeholders: Stakeholder[]; stands: Stand[]; flights: Flight[];
  turnarounds: Turnaround[]; milestones: Milestone[]; tasks: Task[]; staff: StaffCapacity[]; assets: Asset[];
  slaRules: SlaRule[]; slaRisks: SlaRisk[]; exceptions: OpException[]; actions: ActionItem[]; constraints: Constraint[];
}

export interface ScenarioParams {
  lateInbound?: { flightId: string; delayMin: number; standId: string; sensitivity: 'Low' | 'Med' | 'High' };
  weather?: { startOffsetMin: number; durationMin: number; piers: string[]; severity: Severity; recoveryBufferMin: number };
  gse?: { assetType: string; quantityUnavailable: number; pier: string; durationMin: number };
  staff?: { buId: string; capacityDeltaPct: number; windowMin: number; skillGroup?: string };
  slaStress?: { airlineId: string; milestoneType: string; thresholdDeltaMin: number; windowMin: number };
}
export type Mitigation =
  | { kind: 'staff'; buId: string; add: number; fromBuId?: string }
  | { kind: 'gse'; assetType: string; pier: string; qty: number }
  | { kind: 'gate'; fromPiers: string[]; toPier: string; savesMin?: number; flightIds?: string[] }
  | { kind: 'recover'; flightId: string; minutes: number }
  | { kind: 'bufferCut'; minutes: number }
  | { kind: 'deferLow' };

export interface DecisionRecord { optionId: string; by: 'human' | 'copilot'; at: number }
export interface Scenario {
  id: string; name: string; notes: string; state: ScenarioState; createdAt: number; params: ScenarioParams;
  decisions?: Record<string, DecisionRecord>;
}

export interface AuditEvent { id: string; time: number; actor: string; action: string; entityRef?: string; scenarioRef?: string }
export interface DiagEvent { id: string; time: number; kind: 'load' | 'render-error' | 'invalid-scenario' | 'timing'; message: string }

export interface Impact {
  flightDelay: Record<string, number>;
  turnaroundRisk: Record<string, SlaLevel>;
  taskRisk: Record<string, TaskState>;
  milestoneShift: Record<string, number>;
  exceptionSeverity: Record<string, Severity>;
  assetState: Record<string, AssetState>;
  constraints: Constraint[];
  capacityPressure: Record<string, number>;
  factors: Record<string, string[]>;
  impactedIds: string[];
  standOverride: Record<string, string>;
  mitigations: string[];
}

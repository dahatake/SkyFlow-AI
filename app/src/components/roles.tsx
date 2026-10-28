import type { ReactNode } from 'react';
import {
  Building24Regular, Eye24Regular, PersonBoard24Regular, Target24Regular, VehicleTruckProfile24Regular, Wrench24Regular,
} from '@fluentui/react-icons';
import type { RoleType } from '../domain/types';

export type PanelId = 'workflow' | 'kpi' | 'decisions' | 'exceptions' | 'board' | 'viz' | 'risk' | 'resources' | 'detail' | 'owner';
export interface PanelSpec { id: PanelId; span: 1 | 2; secondary?: boolean; view?: 'table' | 'gantt' | 'pipeline' | 'list' }

export interface RoleMeta { icon: ReactNode; short: string; desc: string; focus: string; layout: PanelSpec[] }

/**
 * Panel order per role. Rationale from AOCC / A-CDM and ground-handling practice (web research summary):
 * duty managers live in milestones, exceptions and resource allocation; ramp supervisors in the turnaround Gantt,
 * GSE and roster; station/BU managers in OTP, capacity and SLA penalties; executives in aggregate trends and SLA exposure.
 */
export const ROLE_META: Record<RoleType, RoleMeta> = {
  'Control Tower Lead': {
    icon: <Target24Regular />, short: 'Tower Lead', desc: 'Airport-wide risk, SLA exposure and who owns what',
    focus: 'Needs cross-BU escalation, SLA exposure and accountability first. The map is secondary: leads act on risk and owners, not geometry.',
    layout: [
      { id: 'workflow', span: 2 }, { id: 'kpi', span: 2 },
      { id: 'exceptions', span: 1, view: 'pipeline' }, { id: 'decisions', span: 1 },
      { id: 'risk', span: 1 }, { id: 'board', span: 1, view: 'pipeline' },
      { id: 'viz', span: 2, secondary: true },
    ],
  },
  'SIOC Duty Manager': {
    icon: <Building24Regular />, short: 'Duty Manager', desc: 'Live turnarounds, milestones and interventions now',
    focus: 'Turnaround milestones (Gantt), live exceptions and resource allocation drive minute-by-minute interventions; KPIs are a glance.',
    layout: [
      { id: 'workflow', span: 2 }, { id: 'board', span: 2, view: 'gantt' },
      { id: 'exceptions', span: 1, view: 'list' }, { id: 'decisions', span: 1 },
      { id: 'kpi', span: 2 }, { id: 'detail', span: 1 }, { id: 'viz', span: 1, secondary: true },
    ],
  },
  'BU Ops Manager': {
    icon: <Wrench24Regular />, short: 'BU Ops', desc: 'My BU workload, crew capacity and SLA risk',
    focus: 'Capacity versus workload and SLA risk matter most (roster, GSE, overtime); the map is rarely needed.',
    layout: [
      { id: 'kpi', span: 2 }, { id: 'resources', span: 2 },
      { id: 'board', span: 1, view: 'table' }, { id: 'exceptions', span: 1, view: 'list' },
      { id: 'decisions', span: 1 }, { id: 'risk', span: 1 }, { id: 'workflow', span: 2 }, { id: 'viz', span: 2, secondary: true },
    ],
  },
  'Ramp Lead': {
    icon: <VehicleTruckProfile24Regular />, short: 'Ramp Lead', desc: 'My pier and stands, tasks and equipment next',
    focus: 'Where aircraft and equipment are right now: stand view, turnaround task Gantt, GSE availability and the next action.',
    layout: [
      { id: 'viz', span: 2 }, { id: 'board', span: 2, view: 'gantt' },
      { id: 'resources', span: 1 }, { id: 'exceptions', span: 1, view: 'list' },
      { id: 'workflow', span: 2 }, { id: 'kpi', span: 2, secondary: true },
    ],
  },
  'Action Owner': {
    icon: <PersonBoard24Regular />, short: 'Action Owner', desc: 'What is assigned to me and what depends on it',
    focus: 'Own items, due times and downstream dependencies. Everything else is context.',
    layout: [
      { id: 'owner', span: 2 }, { id: 'workflow', span: 2 },
      { id: 'exceptions', span: 1, view: 'pipeline' }, { id: 'decisions', span: 1 },
      { id: 'detail', span: 1 }, { id: 'board', span: 1, view: 'table', secondary: true }, { id: 'viz', span: 2, secondary: true },
    ],
  },
  Observer: {
    icon: <Eye24Regular />, short: 'Observer', desc: 'Read-only summary, trends and scenario comparison',
    focus: 'Aggregate performance, SLA exposure and scenario comparison without edit controls.',
    layout: [
      { id: 'kpi', span: 2 }, { id: 'risk', span: 1 }, { id: 'workflow', span: 1 },
      { id: 'board', span: 1, view: 'pipeline' }, { id: 'exceptions', span: 1, view: 'list' }, { id: 'viz', span: 2 },
    ],
  },
};

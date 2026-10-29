import { tr } from '../i18n/core';
import { trData } from '../i18n/data';
import { demoById } from './demo';
import type { Scenario, TaskStatus } from './types';

export interface ActionTask {
  id: string;
  decisionId: string;
  optionId: string;
  /** 5W2H */
  what: string; why: string; who: string; where: string; how: string; howMuch: string;
  when: { start: number; due: number };
  priority: 1 | 2 | 3;
  status: TaskStatus;
  progress: number;
  by: 'human' | 'copilot';
  decisionTitle: string;
}

export const PROGRESS: Record<TaskStatus, number> = { Todo: 0, Doing: 50, Done: 100 };

/** Action tasks created by the decisions people (and Copilot assist) have taken. Times are operational minutes. */
export function deriveTasks(sc: Scenario | null | undefined, fallbackNow: number): ActionTask[] {
  const pack = sc && demoById(sc.id);
  if (!sc || !pack) return [];
  const out: ActionTask[] = [];
  pack.decisions.forEach((d) => {
    const rec = sc.decisions?.[d.id];
    const opt = rec && d.options.find((o) => o.id === rec.optionId);
    if (!rec || !opt) return;
    const base = rec.opsAt ?? fallbackNow;
    opt.tasks.forEach((t, i) => {
      const id = `${d.id}:${opt.id}:${i}`;
      const status = sc.taskStatus?.[id] ?? 'Todo';
      out.push({
        id, decisionId: d.id, optionId: opt.id,         decisionTitle: trData(d.title),
                what: trData(t.what), who: t.who, where: trData(t.where), how: trData(t.how), howMuch: trData(t.howMuch),
                why: tr('{title}: {detail} Trade-off: {tradeoff}', { title: trData(d.title), detail: trData(opt.detail), tradeoff: trData(opt.tradeoff) }),
        when: { start: base + t.start, due: base + t.start + t.dur },
        priority: t.priority, status, progress: PROGRESS[status], by: rec.by,
      });
    });
  });
  return out.sort((a, b) => a.priority - b.priority || a.when.due - b.when.due);
}

/**
 * Chainable in-memory Supabase stand-in for agent REST/MCP tests.
 */

import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

export type MemoryDb = {
  workspaces: Row[];
  blocks: Row[];
  profiles: Row[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryAgentSupabase(seed: Partial<MemoryDb> = {}) {
  const db: MemoryDb = {
    workspaces: seed.workspaces ? clone(seed.workspaces) : [],
    blocks: seed.blocks ? clone(seed.blocks) : [],
    profiles: seed.profiles
      ? clone(seed.profiles)
      : [
          {
            id: "user-test",
            username: "tester",
            organization_id: "org-1",
            is_org_admin: true,
            plan: "teams",
          },
        ],
  };

  function tableRows(name: string): Row[] {
    if (name === "workspaces") return db.workspaces;
    if (name === "blocks") return db.blocks;
    if (name === "profiles") return db.profiles;
    return [];
  }

  function from(table: string) {
    const state: {
      rows: Row[];
      pending: Row[] | null;
      filters: Array<[string, unknown]>;
      count?: number;
    } = {
      rows: tableRows(table),
      pending: null,
      filters: [],
    };

    const applyFilters = (rows: Row[]) => {
      return rows.filter((row) =>
        state.filters.every(([col, value]) => row[col] === value),
      );
    };

    const builder: Record<string, unknown> = {};
    const self = () => builder;

    builder.insert = (row: Row | Row[]) => {
      const rows = Array.isArray(row) ? row : [row];
      const inserted = rows.map((item) => {
        const next = {
          id: typeof item.id === "string" ? item.id : randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item,
        };
        tableRows(table).push(next);
        return next;
      });
      state.pending = inserted;
      return self();
    };
    builder.update = (patch: Row) => {
      const targets = applyFilters(tableRows(table));
      for (const row of targets) Object.assign(row, patch, { updated_at: new Date().toISOString() });
      state.pending = targets.map((row) => clone(row));
      return self();
    };
    builder.delete = () => {
      const keep = tableRows(table).filter(
        (row) => !state.filters.every(([col, value]) => row[col] === value),
      );
      const name = table as keyof MemoryDb;
      (db[name] as Row[]).splice(0, (db[name] as Row[]).length, ...keep);
      state.pending = [];
      return self();
    };
    builder.select = (_cols?: string, opts?: { count?: string }) => {
      if (opts?.count === "exact") state.count = applyFilters(tableRows(table)).length;
      return self();
    };
    builder.eq = (col: string, value: unknown) => {
      state.filters.push([col, value]);
      return self();
    };
    builder.or = () => self();
    builder.order = () => self();
    builder.range = () => self();
    builder.limit = () => self();
    builder.maybeSingle = async () => {
      const rows = state.pending ?? applyFilters(tableRows(table));
      return { data: rows[0] ? clone(rows[0]) : null, error: null };
    };
    builder.single = async () => {
      const rows = state.pending ?? applyFilters(tableRows(table));
      const data = rows[0] ? clone(rows[0]) : null;
      return { data, error: data ? null : { message: "not found" } };
    };
    builder.then = (resolve: (value: { data: Row[]; error: null; count: number | null }) => unknown) => {
      const rows = (state.pending ?? applyFilters(tableRows(table))).map((row) => clone(row));
      return Promise.resolve(
        resolve({
          data: rows,
          error: null,
          count: state.count ?? rows.length,
        }),
      );
    };
    return builder;
  }

  return { from, db };
}

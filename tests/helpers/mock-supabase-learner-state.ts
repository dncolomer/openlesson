/**
 * Minimal chainable Supabase mock for learning_world_models + knowledge_config_snapshots + eval_run_history.
 */

export type MockRow = Record<string, unknown>;

function subjectKey(row: {
  workspace_id?: string;
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
}) {
  return `${row.workspace_id}|${row.subject_user_id ?? ""}|${row.subject_guest_user_id ?? ""}`;
}

type TableName = "learning_world_models" | "knowledge_config_snapshots" | "eval_run_history";

export function createLearnerStateMockDb() {
  const lwm: MockRow[] = [];
  const snapshots: MockRow[] = [];
  const evalHistory: MockRow[] = [];
  let idSeq = 1;

  function nextId() {
    return `id-${idSeq++}`;
  }

  type Filter =
    | { col: string; op: "eq" | "is" | "gte" | "lte"; val: unknown }
    | { col: string; op: "in"; val: unknown[] }
    | { op: "or"; expr: string };

  class Query {
    private table: TableName;
    private filters: Filter[] = [];
    private orderSpecs: Array<{ col: string; asc: boolean }> = [];
    private limitN: number | null = null;
    private rangeFrom: number | null = null;
    private rangeTo: number | null = null;
    private selectCols = "*";
    private pendingInsert: MockRow | null = null;
    private pendingUpdate: MockRow | null = null;
    private upsertMode = false;

    constructor(table: TableName) {
      this.table = table;
    }

    select(cols = "*") {
      this.selectCols = cols;
      return this;
    }

    eq(col: string, val: unknown) {
      this.filters.push({ col, op: "eq", val });
      return this;
    }

    is(col: string, val: unknown) {
      this.filters.push({ col, op: "is", val });
      return this;
    }

    gte(col: string, val: unknown) {
      this.filters.push({ col, op: "gte", val });
      return this;
    }

    lte(col: string, val: unknown) {
      this.filters.push({ col, op: "lte", val });
      return this;
    }

    in(col: string, vals: unknown[]) {
      this.filters.push({ col, op: "in", val: vals });
      return this;
    }

    /**
     * Minimal PostgREST or() support for multi-subject filters:
     * `subject_user_id.in.(a,b),subject_guest_user_id.in.(g1)`
     */
    or(expr: string) {
      this.filters.push({ op: "or", expr });
      return this;
    }

    order(col: string, opts?: { ascending?: boolean }) {
      this.orderSpecs.push({ col, asc: opts?.ascending !== false });
      return this;
    }

    limit(n: number) {
      this.limitN = n;
      return this;
    }

    range(from: number, to: number) {
      this.rangeFrom = from;
      this.rangeTo = to;
      return this;
    }

    insert(row: MockRow) {
      this.pendingInsert = { ...row };
      return this;
    }

    update(row: MockRow) {
      this.pendingUpdate = { ...row };
      return this;
    }

    upsert(row: MockRow, _opts?: unknown) {
      this.upsertMode = true;
      this.pendingInsert = { ...row };
      return this;
    }

    private rows(): MockRow[] {
      if (this.table === "learning_world_models") return lwm;
      if (this.table === "knowledge_config_snapshots") return snapshots;
      return evalHistory;
    }

    private matchOr(row: MockRow, expr: string): boolean {
      // Split top-level OR parts on commas that separate clauses (not inside parens).
      const parts: string[] = [];
      let buf = "";
      let depth = 0;
      for (const ch of expr) {
        if (ch === "(") depth += 1;
        if (ch === ")") depth -= 1;
        if (ch === "," && depth === 0) {
          parts.push(buf.trim());
          buf = "";
          continue;
        }
        buf += ch;
      }
      if (buf.trim()) parts.push(buf.trim());

      return parts.some((part) => {
        const inMatch = part.match(/^([a-z_]+)\.in\.\(([^)]*)\)$/i);
        if (inMatch) {
          const col = inMatch[1];
          const vals = inMatch[2]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          return vals.includes(String(row[col] ?? ""));
        }
        const eqMatch = part.match(/^([a-z_]+)\.eq\.(.+)$/i);
        if (eqMatch) {
          return String(row[eqMatch[1]] ?? "") === eqMatch[2];
        }
        return false;
      });
    }

    private match(row: MockRow): boolean {
      return this.filters.every((f) => {
        if (f.op === "or") return this.matchOr(row, f.expr);
        const v = row[f.col];
        if (f.op === "eq") return v === f.val;
        if (f.op === "is") {
          if (f.val === null) return v == null;
          return v === f.val;
        }
        if (f.op === "gte") {
          // Support ISO timestamps and numbers.
          if (typeof v === "string" || typeof f.val === "string") {
            return String(v) >= String(f.val);
          }
          return Number(v) >= Number(f.val);
        }
        if (f.op === "lte") {
          if (typeof v === "string" || typeof f.val === "string") {
            return String(v) <= String(f.val);
          }
          return Number(v) <= Number(f.val);
        }
        if (f.op === "in") return f.val.includes(v);
        return true;
      });
    }

    private applyOrderLimit(rows: MockRow[]): MockRow[] {
      let out = [...rows];
      if (this.orderSpecs.length) {
        out.sort((a, b) => {
          for (const { col, asc } of this.orderSpecs) {
            const av = a[col] as number | string;
            const bv = b[col] as number | string;
            if (av < bv) return asc ? -1 : 1;
            if (av > bv) return asc ? 1 : -1;
          }
          return 0;
        });
      }
      if (this.rangeFrom != null && this.rangeTo != null) {
        out = out.slice(this.rangeFrom, this.rangeTo + 1);
      } else if (this.limitN != null) {
        out = out.slice(0, this.limitN);
      }
      return out;
    }

    private project(row: MockRow): MockRow {
      if (this.selectCols === "*" || !this.selectCols) return row;
      const cols = this.selectCols.split(",").map((c) => c.trim());
      const out: MockRow = {};
      for (const c of cols) out[c] = row[c];
      if (row.id != null && out.id === undefined && cols.includes("id")) out.id = row.id;
      return out;
    }

    async maybeSingle() {
      if (this.upsertMode && this.pendingInsert) {
        const row = this.pendingInsert;
        const key = subjectKey({
          workspace_id: row.workspace_id as string,
          subject_user_id: (row.subject_user_id as string | null) ?? null,
          subject_guest_user_id: (row.subject_guest_user_id as string | null) ?? null,
        });
        const store = this.rows();
        const idx = store.findIndex(
          (r) =>
            subjectKey({
              workspace_id: r.workspace_id as string,
              subject_user_id: (r.subject_user_id as string | null) ?? null,
              subject_guest_user_id: (r.subject_guest_user_id as string | null) ?? null,
            }) === key,
        );
        if (idx >= 0) {
          store[idx] = { ...store[idx], ...row, id: store[idx].id };
          return { data: this.project(store[idx]), error: null };
        }
        const created = { id: nextId(), created_at: new Date().toISOString(), ...row };
        store.push(created);
        return { data: this.project(created), error: null };
      }

      if (this.pendingInsert) {
        const created = {
          id: nextId(),
          created_at: new Date().toISOString(),
          ...this.pendingInsert,
        };
        this.rows().push(created);
        return { data: this.project(created), error: null };
      }

      if (this.pendingUpdate) {
        const matched = this.rows().filter((r) => this.match(r));
        if (matched.length === 0) return { data: null, error: null };
        const target = matched[0];
        Object.assign(target, this.pendingUpdate);
        return { data: this.project(target), error: null };
      }

      const matched = this.applyOrderLimit(this.rows().filter((r) => this.match(r)));
      if (matched.length === 0) return { data: null, error: null };
      return { data: this.project(matched[0]), error: null };
    }

    then<TResult1 = { data: MockRow[] | null; error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: MockRow[] | null; error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      // insert().select().maybeSingle() uses maybeSingle; bare await uses then.
      if (this.pendingInsert && !this.upsertMode) {
        const created = {
          id: nextId(),
          created_at: new Date().toISOString(),
          ...this.pendingInsert,
        };
        this.rows().push(created);
        // After insert without maybeSingle, return array of one for chain compatibility.
        // Consumers using maybeSingle never hit this branch after select.
      }
      const matched = this.applyOrderLimit(this.rows().filter((r) => this.match(r)));
      const result = { data: matched.map((r) => this.project(r)), error: null as null };
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  const supabase = {
    from(table: string) {
      if (
        table !== "learning_world_models" &&
        table !== "knowledge_config_snapshots" &&
        table !== "eval_run_history"
      ) {
        throw new Error(`Unexpected table ${table}`);
      }
      return new Query(table as TableName);
    },
    _state: { lwm, snapshots, evalHistory },
  };

  return supabase as unknown as import("@supabase/supabase-js").SupabaseClient & {
    _state: { lwm: MockRow[]; snapshots: MockRow[]; evalHistory: MockRow[] };
  };
}

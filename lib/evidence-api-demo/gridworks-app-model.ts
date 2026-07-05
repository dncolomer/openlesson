import { getSimulationAction, hasCompletedAction } from "./simulation";
import type { EvidenceApiDemoDefinition } from "./demo-definition";
import type { SimulationAction, SimulationWorldState } from "./types";

export type SheetId = "revenue" | "expenses" | "close";
export type AppMenu = "data" | "formulas" | "review" | "share" | "calendar";

export type InAppAction = {
  id: string;
  simulationId: string;
  label: string;
  hint: string;
  menu?: AppMenu;
  requiresWorkbook?: boolean;
  risky?: boolean;
};

export type SpreadsheetLocalState = {
  workbookCreated: boolean;
  ownerAssigned: boolean;
  activeSheet: SheetId;
  selectedCell: string;
  cells: Record<string, string>;
  csvImported: boolean;
  apiConnected: boolean;
  dateFilterWrong: boolean;
  dateFilterFixed: boolean;
  sumFormulaWritten: boolean;
  pivotBuilt: boolean;
  chartAdded: boolean;
  filterApplied: boolean;
  shared: boolean;
  cellsLocked: boolean;
  snapshotPublished: boolean;
  formulaBroken: boolean;
};

export const SHEET_LABELS: Record<SheetId, string> = {
  revenue: "Revenue",
  expenses: "Expenses",
  close: "Close checklist",
};

export const GRID_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
export const GRID_ROWS = 14;

function cellKey(sheet: SheetId, col: string, row: number) {
  return `${sheet}!${col}${row}`;
}

export function createInitialSpreadsheetState(): SpreadsheetLocalState {
  return {
    workbookCreated: false,
    ownerAssigned: false,
    activeSheet: "revenue",
    selectedCell: "B2",
    cells: {},
    csvImported: false,
    apiConnected: false,
    dateFilterWrong: false,
    dateFilterFixed: false,
    sumFormulaWritten: false,
    pivotBuilt: false,
    chartAdded: false,
    filterApplied: false,
    shared: false,
    cellsLocked: false,
    snapshotPublished: false,
    formulaBroken: false,
  };
}

function seedWorkbookCells(): Record<string, string> {
  const cells: Record<string, string> = {
    [cellKey("revenue", "A", 1)]: "Month",
    [cellKey("revenue", "B", 1)]: "ARR",
    [cellKey("revenue", "C", 1)]: "Services",
    [cellKey("revenue", "A", 2)]: "Jan",
    [cellKey("revenue", "B", 2)]: "128400",
    [cellKey("revenue", "C", 2)]: "18200",
    [cellKey("revenue", "A", 3)]: "Feb",
    [cellKey("revenue", "B", 3)]: "131250",
    [cellKey("revenue", "C", 3)]: "19400",
    [cellKey("expenses", "A", 1)]: "Category",
    [cellKey("expenses", "B", 1)]: "Actual",
    [cellKey("expenses", "C", 1)]: "Budget",
    [cellKey("expenses", "A", 2)]: "Hosting",
    [cellKey("expenses", "B", 2)]: "48200",
    [cellKey("expenses", "C", 2)]: "41000",
    [cellKey("expenses", "A", 3)]: "Payroll",
    [cellKey("expenses", "B", 3)]: "215000",
    [cellKey("expenses", "C", 3)]: "210000",
    [cellKey("close", "A", 1)]: "Task",
    [cellKey("close", "B", 1)]: "Owner",
    [cellKey("close", "C", 1)]: "Status",
    [cellKey("close", "A", 2)]: "Bank reconcile",
    [cellKey("close", "B", 2)]: "—",
    [cellKey("close", "C", 2)]: "Pending",
  };
  return cells;
}

function focusCell(local: SpreadsheetLocalState, sheet: SheetId, col: string, row: number) {
  local.activeSheet = sheet;
  local.selectedCell = `${col}${row}`;
}

const ACTION_EFFECTS: Partial<Record<string, (local: SpreadsheetLocalState) => void>> = {
  create_workbook: (local) => {
    local.workbookCreated = true;
    local.cells = seedWorkbookCells();
    focusCell(local, "revenue", "A", 1);
  },
  assign_close_owner: (local) => {
    local.ownerAssigned = true;
    local.cells[cellKey("close", "B", 2)] = "You";
    focusCell(local, "close", "B", 2);
  },
  skip_template_wizard: (local) => {
    local.workbookCreated = true;
    focusCell(local, "revenue", "A", 1);
  },
  import_csv_feed: (local) => {
    local.csvImported = true;
    local.cells[cellKey("revenue", "A", 4)] = "Mar";
    local.cells[cellKey("revenue", "B", 4)] = "134800";
    local.cells[cellKey("revenue", "C", 4)] = "20100";
    focusCell(local, "revenue", "A", 4);
  },
  connect_api_source: (local) => {
    local.apiConnected = true;
    local.cells[cellKey("revenue", "E", 1)] = "API feed";
    local.cells[cellKey("revenue", "E", 2)] = "Connected";
    focusCell(local, "revenue", "E", 1);
  },
  wrong_date_filter: (local) => {
    local.dateFilterWrong = true;
    local.cells[cellKey("revenue", "D", 1)] = "FILTER_ERR";
    focusCell(local, "revenue", "D", 1);
  },
  fix_date_filter: (local) => {
    local.dateFilterFixed = true;
    local.dateFilterWrong = false;
    local.cells[cellKey("revenue", "D", 1)] = "Q1 slice";
    focusCell(local, "revenue", "D", 1);
  },
  write_sum_formula: (local) => {
    local.sumFormulaWritten = true;
    local.cells[cellKey("revenue", "A", 5)] = "Total";
    local.cells[cellKey("revenue", "B", 5)] = "=SUM(B2:B4)";
    local.cells[cellKey("revenue", "C", 5)] = "=SUM(C2:C4)";
    focusCell(local, "revenue", "B", 5);
  },
  build_pivot_table: (local) => {
    local.pivotBuilt = true;
    local.cells[cellKey("expenses", "E", 1)] = "Pivot";
    local.cells[cellKey("expenses", "E", 2)] = "Hosting +12%";
    focusCell(local, "expenses", "E", 1);
  },
  add_variance_chart: (local) => {
    local.chartAdded = true;
    local.cells[cellKey("expenses", "F", 1)] = "Chart";
    local.cells[cellKey("expenses", "F", 2)] = "Budget vs Actual";
    focusCell(local, "expenses", "F", 1);
  },
  apply_filter_view: (local) => {
    local.filterApplied = true;
    local.cells[cellKey("revenue", "A", 6)] = "Filter view";
    local.cells[cellKey("revenue", "B", 6)] = "Controller review";
    focusCell(local, "revenue", "A", 6);
  },
  share_workbook: (local) => {
    local.shared = true;
    local.cells[cellKey("revenue", "G", 1)] = "Shared";
    local.cells[cellKey("revenue", "G", 2)] = "Controller invited";
    focusCell(local, "revenue", "G", 1);
  },
  lock_formula_cells: (local) => {
    local.cellsLocked = true;
    local.cells[cellKey("close", "C", 2)] = "In review";
    focusCell(local, "close", "C", 2);
  },
  publish_snapshot: (local) => {
    local.snapshotPublished = true;
    local.cells[cellKey("close", "C", 2)] = "Published";
    focusCell(local, "close", "C", 2);
  },
  export_audit_log: (local) => {
    local.cells[cellKey("close", "A", 3)] = "Audit log";
    local.cells[cellKey("close", "B", 3)] = "Exported";
    focusCell(local, "close", "A", 3);
  },
  open_formula_guide: (local) => {
    local.cells[cellKey("revenue", "H", 1)] = "Formula guide";
    local.cells[cellKey("revenue", "H", 2)] = "SUM, PIVOT, FILTER";
    focusCell(local, "revenue", "H", 1);
  },
  join_analyst_session: (local) => {
    local.cells[cellKey("close", "A", 3)] = "Analyst session";
    local.cells[cellKey("close", "B", 3)] = "Live — joined";
    focusCell(local, "close", "A", 3);
  },
  break_formula_chain: (local) => {
    local.formulaBroken = true;
    local.cells[cellKey("revenue", "B", 5)] = "#REF!";
    focusCell(local, "revenue", "B", 5);
  },
  fix_broken_reference: (local) => {
    local.formulaBroken = false;
    if (local.sumFormulaWritten) local.cells[cellKey("revenue", "B", 5)] = "=SUM(B2:B4)";
    focusCell(local, "revenue", "B", 5);
  },
};

export const IN_APP_ACTIONS: InAppAction[] = [
  {
    id: "create_workbook",
    simulationId: "create_workbook",
    label: "New workbook",
    hint: "Start the quarter-close model",
  },
  {
    id: "skip_template_wizard",
    simulationId: "skip_template_wizard",
    label: "Skip template wizard",
    hint: "Experienced analyst — blank grid",
    requiresWorkbook: false,
  },
  {
    id: "assign_close_owner",
    simulationId: "assign_close_owner",
    label: "Assign owner",
    hint: "Name yourself on the close sheet",
    requiresWorkbook: true,
  },
  {
    id: "import_csv_feed",
    simulationId: "import_csv_feed",
    label: "Import CSV",
    hint: "Load March revenue rows",
    menu: "data",
    requiresWorkbook: true,
  },
  {
    id: "connect_api_source",
    simulationId: "connect_api_source",
    label: "Connect API",
    hint: "Pull live billing feed",
    menu: "data",
    requiresWorkbook: true,
  },
  {
    id: "wrong_date_filter",
    simulationId: "wrong_date_filter",
    label: "Wrong date filter",
    hint: "Risky — excludes month-end rows",
    menu: "data",
    requiresWorkbook: true,
    risky: true,
  },
  {
    id: "fix_date_filter",
    simulationId: "fix_date_filter",
    label: "Fix date filter",
    hint: "Restore Q1 slice after mistake",
    menu: "data",
    requiresWorkbook: true,
  },
  {
    id: "write_sum_formula",
    simulationId: "write_sum_formula",
    label: "Write SUM formulas",
    hint: "Total ARR and services",
    menu: "formulas",
    requiresWorkbook: true,
  },
  {
    id: "build_pivot_table",
    simulationId: "build_pivot_table",
    label: "Insert pivot",
    hint: "Summarize expense variance",
    menu: "formulas",
    requiresWorkbook: true,
  },
  {
    id: "add_variance_chart",
    simulationId: "add_variance_chart",
    label: "Add chart",
    hint: "Visualize budget vs actual",
    menu: "formulas",
    requiresWorkbook: true,
  },
  {
    id: "apply_filter_view",
    simulationId: "apply_filter_view",
    label: "Saved filter view",
    hint: "Controller review slice",
    menu: "formulas",
    requiresWorkbook: true,
  },
  {
    id: "share_workbook",
    simulationId: "share_workbook",
    label: "Share workbook",
    hint: "Invite controller reviewer",
    menu: "share",
    requiresWorkbook: true,
  },
  {
    id: "lock_formula_cells",
    simulationId: "lock_formula_cells",
    label: "Lock cells",
    hint: "Protect formula ranges",
    menu: "review",
    requiresWorkbook: true,
  },
  {
    id: "publish_snapshot",
    simulationId: "publish_snapshot",
    label: "Publish snapshot",
    hint: "Ship close package",
    menu: "review",
    requiresWorkbook: true,
  },
  {
    id: "export_audit_log",
    simulationId: "export_audit_log",
    label: "Export audit log",
    hint: "Compliance trail download",
    menu: "review",
    requiresWorkbook: true,
  },
  {
    id: "open_formula_guide",
    simulationId: "open_formula_guide",
    label: "Formula guide",
    hint: "Open in-app reference",
    menu: "review",
    requiresWorkbook: true,
  },
  {
    id: "join_analyst_session",
    simulationId: "join_analyst_session",
    label: "Analyst session",
    hint: "Live office hours",
    menu: "review",
    requiresWorkbook: true,
  },
  {
    id: "break_formula_chain",
    simulationId: "break_formula_chain",
    label: "Break reference",
    hint: "Risky — corrupt totals row",
    menu: "formulas",
    requiresWorkbook: true,
    risky: true,
  },
  {
    id: "fix_broken_reference",
    simulationId: "fix_broken_reference",
    label: "Fix #REF!",
    hint: "Repair broken formula",
    menu: "formulas",
    requiresWorkbook: true,
  },
];

export const CALENDAR_PAUSE_ACTIONS = [
  {
    id: "pause_1_day",
    simulationId: "wait_1_day",
    label: "+1 day",
    hint: "Record idle time",
  },
  {
    id: "pause_3_days",
    simulationId: "wait_3_days",
    label: "+3 days",
    hint: "Mid-close gap",
  },
  {
    id: "pause_1_week",
    simulationId: "wait_1_week",
    label: "+1 week",
    hint: "Return after delay",
  },
] as const;

const SIMULATION_TO_LOCAL: Record<string, string> = {
  create_workbook: "create_workbook",
  assign_close_owner: "assign_close_owner",
  skip_template_wizard: "skip_template_wizard",
  import_csv_feed: "import_csv_feed",
  connect_api_source: "connect_api_source",
  wrong_date_filter: "wrong_date_filter",
  fix_date_filter: "fix_date_filter",
  write_sum_formula: "write_sum_formula",
  build_pivot_table: "build_pivot_table",
  add_variance_chart: "add_variance_chart",
  apply_filter_view: "apply_filter_view",
  share_workbook: "share_workbook",
  lock_formula_cells: "lock_formula_cells",
  publish_snapshot: "publish_snapshot",
  export_audit_log: "export_audit_log",
  open_formula_guide: "open_formula_guide",
  join_analyst_session: "join_analyst_session",
  break_formula_chain: "break_formula_chain",
  fix_broken_reference: "fix_broken_reference",
};

export function deriveLocalStateFromWorld(
  worldState: SimulationWorldState,
  base: SpreadsheetLocalState = createInitialSpreadsheetState()
): SpreadsheetLocalState {
  const local = structuredClone(base);
  const completed = new Set([
    ...worldState.completedActions,
    ...Object.keys(worldState.actionCounts),
  ]);

  for (const simId of completed) {
    const localId = SIMULATION_TO_LOCAL[simId];
    if (!localId) continue;
    ACTION_EFFECTS[localId]?.(local);
  }

  return local;
}

export function resolveSimulationAction(
  demo: EvidenceApiDemoDefinition,
  simulationId: string
): SimulationAction | undefined {
  return getSimulationAction(demo, simulationId);
}

export function applyInAppAction(
  local: SpreadsheetLocalState,
  action: InAppAction
): SpreadsheetLocalState {
  const next = { ...local, cells: { ...local.cells } };
  ACTION_EFFECTS[action.id]?.(next);
  return next;
}

export function getAvailableInAppActions({
  demo,
  worldState,
  local,
  menu,
  running,
}: {
  demo: EvidenceApiDemoDefinition;
  worldState: SimulationWorldState;
  local: SpreadsheetLocalState;
  menu: AppMenu | null;
  running: boolean;
}): InAppAction[] {
  if (running) return [];

  const available: InAppAction[] = [];

  for (const action of IN_APP_ACTIONS) {
    if (menu !== null && action.menu !== menu) continue;
    if (menu === null && action.menu) continue;

    const simulation = getSimulationAction(demo, action.simulationId);
    if (!simulation) continue;
    if (hasCompletedAction(worldState, action.simulationId) && !simulation.repeatable) continue;

    if (action.requiresWorkbook && !local.workbookCreated && action.id !== "create_workbook") continue;
    if (!local.workbookCreated && action.id === "assign_close_owner") continue;
    if (action.id === "fix_date_filter" && !local.dateFilterWrong) continue;
    if (action.id === "fix_broken_reference" && !local.formulaBroken) continue;
    if (action.id === "skip_template_wizard" && local.workbookCreated) continue;

    available.push(action);
  }

  if (menu === "calendar") {
    return CALENDAR_PAUSE_ACTIONS.filter((pause) => {
      const simulation = getSimulationAction(demo, pause.simulationId);
      return Boolean(simulation);
    }) as unknown as InAppAction[];
  }

  return available;
}

export function getCellDisplay(local: SpreadsheetLocalState, sheet: SheetId, col: string, row: number) {
  const raw = local.cells[cellKey(sheet, col, row)] ?? "";
  if (raw.startsWith("=SUM(B2:B4)") && col === "B" && row === 5) return "394450";
  if (raw.startsWith("=SUM(C2:C4)") && col === "C" && row === 5) return "57700";
  return raw;
}

export function getFormulaBarValue(local: SpreadsheetLocalState) {
  const match = local.selectedCell.match(/^([A-J])(\d+)$/);
  if (!match) return "";
  const [, col, rowStr] = match;
  const row = Number(rowStr);
  return local.cells[cellKey(local.activeSheet, col, row)] ?? "";
}

export function selectCell(local: SpreadsheetLocalState, col: string, row: number): SpreadsheetLocalState {
  return { ...local, selectedCell: `${col}${row}` };
}
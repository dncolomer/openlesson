"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Database,
  FileSpreadsheet,
  FunctionSquare,
  Share2,
  Shield,
} from "lucide-react";
import { DemoPerformanceHud } from "@/components/proof-of-work-demo/DemoPerformanceHud";
import { DemoVerificationPills } from "@/components/proof-of-work-demo/DemoVerificationPills";
import { getDemoVerificationPills } from "@/lib/product-demos/verification-pills";
import { GRIDWORKS_TAP_VALIDATION_HINT } from "@/lib/product-demos/tap-validation";
import type { ConversionGoalSource } from "@/lib/agent-v2/conversion-goal";
import type { PerformanceReport } from "@/lib/agent-v2/performance-context";
import type { ProofOfWorkApiDemoDefinition } from "@/lib/product-demos/demo-definition";
import {
  applyInAppAction,
  CALENDAR_PAUSE_ACTIONS,
  createInitialSpreadsheetState,
  deriveLocalStateFromWorld,
  getAvailableInAppActions,
  getCellDisplay,
  getFormulaBarValue,
  GRID_COLS,
  GRID_ROWS,
  IN_APP_ACTIONS,
  resolveSimulationAction,
  selectCell,
  SHEET_LABELS,
  type AppMenu,
  type InAppAction,
  type SheetId,
} from "@/lib/product-demos/gridworks-app-model";
import { totalActionCount } from "@/lib/product-demos/simulation";
import type { SimulationAction, SimulationWorldState } from "@/lib/product-demos/types";

const MENU_META: Array<{ id: AppMenu; label: string; icon: typeof Database }> = [
  { id: "data", label: "Data", icon: Database },
  { id: "formulas", label: "Formulas", icon: FunctionSquare },
  { id: "review", label: "Review", icon: Shield },
  { id: "share", label: "Share", icon: Share2 },
  { id: "calendar", label: "Calendar", icon: Calendar },
];

function ActionButton({
  action,
  busy,
  onClick,
}: {
  action: InAppAction | (typeof CALENDAR_PAUSE_ACTIONS)[number];
  busy: boolean;
  onClick: () => void;
}) {
  const risky = "risky" in action && action.risky;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs transition disabled:opacity-45 ${
        risky
          ? "border-amber-700/50 bg-amber-950/35 text-amber-100 hover:border-amber-600"
          : "border-zinc-700 bg-black/30 text-zinc-300 hover:border-emerald-500/40 hover:text-white"
      }`}
    >
      <div className="font-medium">{action.label}</div>
      <div className="text-[10px] text-zinc-500">{action.hint}</div>
    </button>
  );
}

export function GridworksApp({
  demo,
  worldState,
  runningActionId,
  onRunAction,
  report,
  isReporting,
  workspaceConversionGoal,
  conversionGoalSource,
  tapLinkUrl = null,
  isCreatingTapLink = false,
  onOpenTapValidation,
}: {
  demo: ProofOfWorkApiDemoDefinition;
  worldState: SimulationWorldState;
  runningActionId: string | null;
  onRunAction: (action: SimulationAction) => void;
  report: PerformanceReport | null;
  isReporting: boolean;
  workspaceConversionGoal?: string;
  conversionGoalSource?: ConversionGoalSource;
  tapLinkUrl?: string | null;
  isCreatingTapLink?: boolean;
  onOpenTapValidation?: () => void;
}) {
  const [localState, setLocalState] = useState(createInitialSpreadsheetState);
  const [openMenu, setOpenMenu] = useState<AppMenu | null>(null);

  const busy = runningActionId !== null;
  const turnCount = totalActionCount(worldState);

  const starterActions = useMemo(
    () =>
      getAvailableInAppActions({
        demo,
        worldState,
        local: localState,
        menu: null,
        running: busy,
      }),
    [demo, worldState, localState, busy]
  );

  const menuActions = useMemo(() => {
    if (!openMenu) return [];
    return getAvailableInAppActions({
      demo,
      worldState,
      local: localState,
      menu: openMenu,
      running: busy,
    });
  }, [demo, worldState, localState, openMenu, busy]);

  useEffect(() => {
    setLocalState((prior) => {
      const derived = deriveLocalStateFromWorld(worldState, createInitialSpreadsheetState());
      return derived.workbookCreated || Object.keys(derived.cells).length > 0 ? derived : prior;
    });
     
  }, [worldState]);

  const fireAction = useCallback(
    (inApp: InAppAction | (typeof CALENDAR_PAUSE_ACTIONS)[number]) => {
      const simulation = resolveSimulationAction(demo, inApp.simulationId);
      if (!simulation || busy) return;

      onRunAction(simulation);

      const catalog = IN_APP_ACTIONS.find((a) => a.id === inApp.id);
      if (catalog) {
        setLocalState((prev) => applyInAppAction(prev, catalog));
      }
    },
    [demo, busy, onRunAction]
  );

  const formulaValue = getFormulaBarValue(localState);
  const selectedFormula = formulaValue.startsWith("=");

  return (
    <div className="relative flex w-full min-h-[36rem] flex-col bg-zinc-950 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">GridWorks</span>
            <span className="font-mono text-[10px] text-zinc-500">
              {localState.workbookCreated ? "Q1_Close_Model.xlsx" : "Untitled"}
            </span>
          </div>
          <DemoVerificationPills pills={getDemoVerificationPills(demo)} />
          <span className="font-mono text-[10px] text-zinc-500">Actions {turnCount}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
          <span className="font-mono text-[10px] text-zinc-500">fx</span>
          <div
            aria-label={`Cell ${localState.selectedCell} value`}
            className={`min-w-0 flex-1 truncate rounded border border-zinc-800 bg-black/20 px-2 py-1 font-mono text-xs ${
              selectedFormula ? "text-emerald-200" : "text-zinc-400"
            }`}
          >
            {formulaValue || (localState.workbookCreated ? "" : "Use actions below to populate cells")}
          </div>
          <span className="font-mono text-[10px] text-zinc-500">{localState.selectedCell}</span>
        </div>

        <div className="flex flex-col text-[11px]">
          <div className="flex shrink-0 border-b border-zinc-800 bg-zinc-900">
            <div className="w-8 shrink-0 border-r border-zinc-800" />
            {GRID_COLS.map((col) => (
              <div
                key={`h-${col}`}
                className="min-w-0 flex-1 border-r border-zinc-800 py-1 text-center font-mono text-zinc-500"
              >
                {col}
              </div>
            ))}
          </div>
          {Array.from({ length: GRID_ROWS }, (_, rowIndex) => {
            const row = rowIndex + 1;
            return (
              <div key={`row-${row}`} className="flex h-7 shrink-0">
                <div className="flex w-8 shrink-0 items-center justify-center border-b border-r border-zinc-800 bg-zinc-900 font-mono text-zinc-500">
                  {row}
                </div>
                {GRID_COLS.map((col) => {
                  const selected = localState.selectedCell === `${col}${row}`;
                  const display = getCellDisplay(localState, localState.activeSheet, col, row);
                  const isHeader = row === 1;
                  const isError = display === "#REF!";
                  const isFormula = selected && formulaValue.startsWith("=");
                  return (
                    <button
                      key={`${col}${row}`}
                      type="button"
                      onClick={() => setLocalState((prev) => selectCell(prev, col, row))}
                      className={`min-w-0 flex-1 border-b border-r border-zinc-800/80 px-1 py-0.5 text-left font-mono transition ${
                        selected
                          ? "bg-emerald-950/50 ring-1 ring-inset ring-emerald-500/50"
                          : "bg-zinc-950 hover:bg-zinc-900"
                      } ${isHeader && display ? "font-semibold text-zinc-300" : "text-zinc-400"} ${
                        isError ? "text-red-400" : ""
                      } ${isFormula ? "text-emerald-200" : ""}`}
                    >
                      <span className="block truncate">{display}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {localState.workbookCreated ? (
          <div className="flex shrink-0 items-center gap-1 border-t border-zinc-800 bg-zinc-900/80 px-2 py-1">
            {(Object.keys(SHEET_LABELS) as SheetId[]).map((sheetId) => (
              <button
                key={sheetId}
                type="button"
                onClick={() => setLocalState((prev) => ({ ...prev, activeSheet: sheetId }))}
                className={`rounded px-2.5 py-1 text-[10px] transition ${
                  localState.activeSheet === sheetId
                    ? "bg-emerald-700/30 text-emerald-100"
                    : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                }`}
              >
                {SHEET_LABELS[sheetId]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950/95">
          {localState.workbookCreated ? (
            <>
              <div className="flex items-stretch justify-center gap-1 px-2 py-1.5">
                {MENU_META.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    onClick={() => setOpenMenu((prev) => (prev === id ? null : id))}
                    className={`flex min-w-[4rem] flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] transition disabled:opacity-40 ${
                      openMenu === id
                        ? "bg-emerald-600/20 text-emerald-100"
                        : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              {openMenu ? (
                <div className="border-t border-zinc-800/80 px-3 py-2">
                  {menuActions.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {menuActions.map((action) => (
                        <ActionButton
                          key={action.id}
                          action={action}
                          busy={busy}
                          onClick={() => {
                            fireAction(action);
                            setOpenMenu(null);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-xs text-zinc-600">No actions available in this menu yet.</p>
                  )}
                </div>
              ) : (
                <p className="border-t border-zinc-800/80 px-3 py-2 text-center text-xs text-zinc-600">
                  Pick a menu to import data, write formulas, and publish your close snapshot.
                </p>
              )}
            </>
          ) : (
            <div className="px-3 py-3">
              <p className="mb-2 text-center text-xs text-zinc-500">Start your quarter-close workbook</p>
              <div className="flex flex-wrap justify-center gap-2">
                {starterActions.map((action) => (
                  <ActionButton
                    key={action.id}
                    action={action}
                    busy={busy}
                    onClick={() => fireAction(action)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <DemoPerformanceHud
        report={report}
        isReporting={isReporting}
        workspaceConversionGoal={workspaceConversionGoal}
        conversionGoalSource={conversionGoalSource}
        showTapValidation
        tapValidationHint={GRIDWORKS_TAP_VALIDATION_HINT}
        tapLinkUrl={tapLinkUrl}
        isCreatingTapLink={isCreatingTapLink}
        onOpenTapValidation={onOpenTapValidation}
      />
    </div>
  );
}
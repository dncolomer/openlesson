import { describe, expect, it } from "vitest";
import { gridworksDemo } from "@/lib/product-demos/demos/gridworks";
import {
  applyInAppAction,
  createInitialSpreadsheetState,
  getAvailableInAppActions,
  IN_APP_ACTIONS,
} from "@/lib/product-demos/gridworks-app-model";
import { createInitialWorldState } from "@/lib/product-demos/simulation";

describe("gridworks app model", () => {
  it("starts with workbook creation actions only", () => {
    const local = createInitialSpreadsheetState();
    const actions = getAvailableInAppActions({
      demo: gridworksDemo,
      worldState: createInitialWorldState(),
      local,
      menu: null,
      running: false,
    });

    expect(actions.map((a) => a.id)).toContain("create_workbook");
    expect(actions.map((a) => a.id)).toContain("skip_template_wizard");
    expect(actions.map((a) => a.id)).not.toContain("import_csv_feed");
  });

  it("unlocks data menu actions after workbook creation", () => {
    const local = createInitialSpreadsheetState();
    local.workbookCreated = true;

    const actions = getAvailableInAppActions({
      demo: gridworksDemo,
      worldState: createInitialWorldState(),
      local,
      menu: "data",
      running: false,
    });

    expect(actions.map((a) => a.id)).toContain("import_csv_feed");
  });

  it("places imported CSV rows and focuses the top-left inserted cell", () => {
    const local = createInitialSpreadsheetState();
    local.workbookCreated = true;
    const action = IN_APP_ACTIONS.find((a) => a.id === "import_csv_feed");
    expect(action).toBeDefined();

    const next = applyInAppAction(local, action!);
    expect(next.cells["revenue!A4"]).toBe("Mar");
    expect(next.activeSheet).toBe("revenue");
    expect(next.selectedCell).toBe("A4");
  });

  it("writes SUM formulas in the totals row and focuses the formula cell", () => {
    const local = createInitialSpreadsheetState();
    local.workbookCreated = true;
    const action = IN_APP_ACTIONS.find((a) => a.id === "write_sum_formula");
    expect(action).toBeDefined();

    const next = applyInAppAction(local, action!);
    expect(next.cells["revenue!A5"]).toBe("Total");
    expect(next.cells["revenue!B5"]).toBe("=SUM(B2:B4)");
    expect(next.selectedCell).toBe("B5");
  });
});
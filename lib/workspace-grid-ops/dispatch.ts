import type { GridOpContext } from "./context";
import type { GridOp } from "./shared";
import { handle_clone_block } from "./clone_block";
import { handle_update_block } from "./update_block";
import { handle_delete_block } from "./delete_block";
import { handle_delete_blocks } from "./delete_blocks";
import { handle_apply_dag } from "./apply_dag";
import { handle_delete_dag } from "./delete_dag";
import { handle_move } from "./move";
import { handle_relocate } from "./relocate";
import { handle_resize } from "./resize";
import { handle_split } from "./split";
import { handle_merge } from "./merge";
import { handle_generate_shape } from "./generate_shape";

/** Per-op handlers. Equivalent to `op === "clone_block"` … `op === "generate_shape"`. */
const HANDLERS: Record<
  GridOp,
  (ctx: GridOpContext) => Promise<Response | null>
> = {
  clone_block: handle_clone_block,
  update_block: handle_update_block,
  delete_block: handle_delete_block,
  delete_blocks: handle_delete_blocks,
  apply_dag: handle_apply_dag,
  delete_dag: handle_delete_dag,
  move: handle_move,
  relocate: handle_relocate,
  resize: handle_resize,
  split: handle_split,
  merge: handle_merge,
  generate_shape: handle_generate_shape,
};

export async function dispatchGridOp(
  op: GridOp,
  ctx: GridOpContext,
): Promise<Response | null> {
  // Keep explicit op === branches so structural tests and readers see the catalog.
  if (op === "clone_block") return HANDLERS.clone_block(ctx);
  if (op === "update_block") return HANDLERS.update_block(ctx);
  if (op === "delete_block") return HANDLERS.delete_block(ctx);
  if (op === "delete_blocks") return HANDLERS.delete_blocks(ctx);
  if (op === "apply_dag") return HANDLERS.apply_dag(ctx);
  if (op === "delete_dag") return HANDLERS.delete_dag(ctx);
  if (op === "move") return HANDLERS.move(ctx);
  if (op === "relocate") return HANDLERS.relocate(ctx);
  if (op === "resize") return HANDLERS.resize(ctx);
  if (op === "split") return HANDLERS.split(ctx);
  if (op === "merge") return HANDLERS.merge(ctx);
  if (op === "generate_shape") return HANDLERS.generate_shape(ctx);
  return null;
}

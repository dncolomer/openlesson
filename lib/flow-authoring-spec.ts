/**
 * Public create_flow / update_flow Author contract.
 * Same exclusive sources and overlaps as the dashboard wizard.
 */

export const FLOW_AUTHORING_CREATE_SPEC = `Choose exactly one Author source.

1. Written problem — send topic (aliases problem, goal). Solve/Verification may set exact_problem_on_canvas so that text opens on the Work canvas as written. Artifacts may ride along as Unsys context. Do not set generate_problem_on_open or opening_canvas_scene.
2. From files — send artifacts or files. A new problem statement is generated when a learner opens (generate_problem_on_open). Topic may be empty; stored topic falls back to name. The board stays empty. exact_problem_on_canvas is ignored.
3. Prepared board — send opening_canvas_scene (Solve/Verification). Topic may be empty; stored topic falls back to board text then name. exact_problem_on_canvas and generate_problem_on_open are ignored. Calibration has no canvas.

If more than one source is sent, the server keeps prepared board, then files with generate_problem_on_open, then written topic. exact_problem_on_canvas is stored only with a written topic.`;

/**
 * Public create_protocol / update_protocol Author contract.
 * Same exclusive sources and overlaps as the dashboard wizard.
 * There is no kind picker — only knowledge verification protocols.
 */

export const FLOW_AUTHORING_CREATE_SPEC = `Choose exactly one Author source.

1. Written Protocol Challenge — send challenge (aliases topic, problem, goal). May set exact_problem_on_canvas so that text opens on the Work canvas as written. Artifacts may ride along as Unsys context. Do not set generate_problem_on_open or opening_canvas_scene.
2. From files — send artifacts or files. A new challenge statement is generated when a learner opens (generate_problem_on_open). Challenge may be empty; stored challenge falls back to name. The board stays empty. exact_problem_on_canvas is ignored.
3. Prepared board — send opening_canvas_scene. Challenge may be empty; stored challenge falls back to board text then name. exact_problem_on_canvas and generate_problem_on_open are ignored.

If more than one source is sent, the server keeps prepared board, then files with generate_problem_on_open, then written challenge. exact_problem_on_canvas is stored only with a written challenge.

Do not send kind. Create and list reject solve, calibration, calibrate, learn, mapping, and map.`;

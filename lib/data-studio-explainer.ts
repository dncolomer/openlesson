/**
 * Data Studio help/explainer copy. The map view swaps to this board in-place.
 * Tests drive these helpers — do not re-implement in tests.
 */

import type { DataStudioProduct } from "@/lib/data-studio-view";

function explainerProductLabel(product: DataStudioProduct): string {
  if (product === "verification") return "Verification";
  if (product === "calibration") return "Calibration";
  return "Learning";
}

export const DATA_STUDIO_VIEWS = ["map", "help"] as const;
export type DataStudioView = (typeof DATA_STUDIO_VIEWS)[number];

export function parseDataStudioView(value: unknown): DataStudioView {
  return value === "help" ? "help" : "map";
}

export const DATA_STUDIO_EXPLAINER_FIGURE_IDS = [
  "walk",
  "spaces",
  "overlay",
  "inspect",
] as const;

export type DataStudioExplainerFigureId = (typeof DATA_STUDIO_EXPLAINER_FIGURE_IDS)[number];

export type DataStudioExplainerFigure = {
  id: DataStudioExplainerFigureId;
  title: string;
  body: string;
};

export type DataStudioExplainerCopy = {
  product: DataStudioProduct;
  productLabel: string;
  kicker: string;
  title: string;
  lede: string;
  figures: DataStudioExplainerFigure[];
  controls: string;
};

const WALK_FIGURE: DataStudioExplainerFigure = {
  id: "walk",
  title: "Hidden-state walk",
  body: "Each point is one finished run. Path space records the hidden-state tree and the priced edges taken — the same graph the session scores as Distance.",
};

const SPACES_FIGURE: DataStudioExplainerFigure = {
  id: "spaces",
  title: "Path and Path + Text",
  body: "Path ignores how someone spoke. Two people on the same walk sit together. Path + Text mixes that walk with spoken and written transcripts, so the same walk can split when the words differ.",
};

const INSPECT_FIGURE: DataStudioExplainerFigure = {
  id: "inspect",
  title: "Click a point",
  body: "The inspect panel keeps identity, flow, run, voice transcripts, proof of work, and recoverable raw. Switching space only changes the map and the vector on that record.",
};

function overlayFigure(product: DataStudioProduct): DataStudioExplainerFigure {
  if (product === "learning") {
    return {
      id: "overlay",
      title: "Maps you played",
      body: "Learning Data Studio is play copies you added from Home. Filter by map. Authored maps stay on Build. Knowledge regions stay off this product.",
    };
  }
  if (product === "calibration") {
    return {
      id: "overlay",
      title: "Sounding field",
      body: "Calibrate stores the tree without a projected policy, so Path is the field they sounded. Region disks overlay only when the region was built in the space you have selected. Hide disks from the legend. Distances draws dashed rays labeled with ‖x−c‖ in embedding space, not the 2D layout. In region colors dots by cosine membership in 96-D. The solid spread disk is the mean L2 of the builders to the centroid, flattened to 2D — how tight that cohort was. The dashed ring is the cosine ball flattened to 2D. PCA distorts distances, so a bright dot can sit outside the white disk and still be in.",
    };
  }
  return {
    id: "overlay",
    title: "Knowledge regions",
    body: "White disks are regions built from Path or Path + Text centroids. A disk appears only when its model matches the selected space. Hide a disk from the legend. Distances draws dashed rays labeled with ‖x−c‖ in embedding space, not the 2D layout. In region colors dots by cosine ≥ τ in 96-D, not the projected circle. The solid spread disk is the mean L2 of the builders to the centroid (mean_radius), flattened to 2D — how tightly those people clustered. The dashed ring is the cosine ball flattened the same way. PCA does not preserve distances, so a bright dot can sit outside the white disk and still be in. Filter by flow and run to compare people.",
  };
}

function ledeFor(product: DataStudioProduct): string {
  if (product === "learning") {
    return "This map is Learn sessions on play copies you added. Nearby points walked similar hidden-state paths on those maps.";
  }
  if (product === "calibration") {
    return "This map is Calibrate soundings. Nearby points sounded similar hidden-state trees.";
  }
  return "This map is Verify runs. Nearby points walked the hidden-state tree in similar ways.";
}

function controlsFor(product: DataStudioProduct): string {
  if (product === "learning") {
    return "Choose Path or Path + Text, pick a projection, and filter by map. Drag to pan. Scroll to zoom. Press Help again to return to the map.";
  }
  return "Choose Path or Path + Text, pick a projection, and filter by flow or run with search and multi-select. Toggle Distances for high-dimensional L2 to region centers. Toggle In region to color dots by cosine membership and show the dashed cosine-ball ring. Drag to pan. Scroll to zoom. Press Help again to return to the map.";
}

export function dataStudioExplainer(product: DataStudioProduct): DataStudioExplainerCopy {
  const productLabel = explainerProductLabel(product);
  return {
    product,
    productLabel,
    kicker: `${productLabel} Data Studio`,
    title: "How to read this map",
    lede: ledeFor(product),
    figures: [WALK_FIGURE, SPACES_FIGURE, overlayFigure(product), INSPECT_FIGURE],
    controls: controlsFor(product),
  };
}

/**
 * In-process Work canvas room: main session + PiP are two Excalidraw
 * peers on one board. Excalidraw does not ship a collab server; it
 * exposes isCollaborating / collaborators / updateScene for the host.
 */

export type IleWorkCanvasPeerId = "work" | "pip";

export type IleWorkCanvasRoomSceneMessage = {
  kind: "scene";
  from: IleWorkCanvasPeerId;
  nonce: number;
  elements: readonly unknown[];
  files: Record<string, unknown>;
};

export type IleWorkCanvasRoomPointerMessage = {
  kind: "pointer";
  from: IleWorkCanvasPeerId;
  pointer: { x: number; y: number; tool?: "pointer" | "laser" } | null;
  button?: "up" | "down";
  selectedElementIds?: Record<string, boolean>;
};

export type IleWorkCanvasRoomMessage =
  | IleWorkCanvasRoomSceneMessage
  | IleWorkCanvasRoomPointerMessage;

type Listener = (message: IleWorkCanvasRoomMessage) => void;

type Room = {
  listeners: Set<Listener>;
  peers: Set<IleWorkCanvasPeerId>;
  nonce: number;
};

const rooms = new Map<string, Room>();

function roomOf(boardId: string): Room {
  const id = String(boardId || "").trim() || "default";
  let room = rooms.get(id);
  if (!room) {
    room = { listeners: new Set(), peers: new Set(), nonce: 0 };
    rooms.set(id, room);
  }
  return room;
}

export function ileWorkCanvasPeerLabel(peer: IleWorkCanvasPeerId): string {
  return peer === "pip" ? "PiP" : "Work";
}

export function ileWorkCanvasOtherPeer(
  peer: IleWorkCanvasPeerId,
): IleWorkCanvasPeerId {
  return peer === "pip" ? "work" : "pip";
}

export function countIleWorkCanvasRoomPeers(boardId: string): number {
  return roomOf(boardId).peers.size;
}

export function nextIleWorkCanvasRoomNonce(boardId: string): number {
  const room = roomOf(boardId);
  room.nonce += 1;
  return room.nonce;
}

export function publishIleWorkCanvasRoom(
  boardId: string,
  message: IleWorkCanvasRoomMessage,
): void {
  const room = roomOf(boardId);
  for (const listener of room.listeners) {
    try {
      listener(message);
    } catch {
      /* peer unmounted */
    }
  }
}

export function subscribeIleWorkCanvasRoom(
  boardId: string,
  peer: IleWorkCanvasPeerId,
  listener: Listener,
): () => void {
  const room = roomOf(boardId);
  room.peers.add(peer);
  room.listeners.add(listener);
  return () => {
    room.listeners.delete(listener);
    room.peers.delete(peer);
    publishIleWorkCanvasRoom(boardId, {
      kind: "pointer",
      from: peer,
      pointer: null,
    });
    if (room.listeners.size === 0) rooms.delete(String(boardId || "").trim() || "default");
  };
}

export function ileWorkCanvasSceneFingerprint(
  elements: readonly unknown[] | null | undefined,
  files?: Record<string, unknown> | null,
): string {
  try {
    return JSON.stringify({
      e: (elements ?? []).map((el) => {
        if (!el || typeof el !== "object") return el;
        const rec = el as Record<string, unknown>;
        return [rec.id, rec.version, rec.versionNonce, rec.isDeleted];
      }),
      f: Object.keys(files ?? {}).sort(),
    });
  } catch {
    return "";
  }
}

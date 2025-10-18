import type { FieldValue } from "firebase/firestore";

export type Player = { name: string; slot: number; joinedAt: FieldValue };
export type RoomDoc = {
  host: string;
  players: Player[];
  seed: string;
  width: number;
  height: number;
  tick: number;
  settings?: Settings;
};

export type Settings = {
  bubbleCount: number;
  colors: string[];
};

export type Bubble = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  clusterId: null | string;
  isLeader: boolean;
};

export type Cursor = {
  x: number;
  y: number;
  inside: boolean;
};

export type Cluster = {
  color: string;
  members: Set<number>;
};

export type ClusterMap = Map<string, Cluster>;

export type RoomMeta = {
  host: string;
  settings?: Settings;
  width?: number;
  seed: number;
  height?: number;
  tick?: number;
  won?: boolean;
};

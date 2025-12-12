export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  NONE = 'NONE'
}

export enum TileType {
  EMPTY = 0,
  WALL_HARD = 1, // Indestructible
  WALL_SOFT = 2, // Destructible
}

export enum PowerUpType {
  BOMB_UP = 'BOMB_UP', // Extra bomb count
  FIRE_UP = 'FIRE_UP', // Extra range (+1)
  SPEED_UP = 'SPEED_UP', // Extra speed
  SUPER_BOMB = 'SUPER_BOMB', // Max range
  TIME_BONUS = 'TIME_BONUS', // +30s
}

export interface Point {
  x: number;
  y: number;
}

export interface GridPoint {
  col: number; // x index
  row: number; // y index
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum GameState {
  MENU,
  PLAYING,
  LEVEL_COMPLETE, // New state
  GAME_OVER,
  VICTORY,
  LEVEL_TRANSITION
}

export interface GameStats {
  score: number;
  lives: number;
  level: number;
  timeLeft: number;
}

// Minimal A* Node
export interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}
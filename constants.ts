export const TILE_SIZE = 48; // px
export const GRID_ROWS = 13;
export const GRID_COLS = 15;
export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE;

export const FPS = 60;
export const FRAME_TIME = 1000 / FPS;

// Gameplay balance - EASIER SETTINGS
export const PLAYER_SPEED_BASE = 5.0; // Faster player (was 4.5)
export const ENEMY_SPEED_BASE = 2.0; // Slower enemies (was 2.5)
export const BOMB_TIMER_MS = 2000;
export const EXPLOSION_DURATION_MS = 600;
export const INVULNERABILITY_MS = 2500; // Longer shield

// Cyberpunk / Military Theme Colors
export const COLORS = {
  // Map
  BG: '#0f172a', // Dark slate/blue
  BG_CHECKER: '#1e293b',
  WALL_HARD: '#334155', // Slate
  WALL_HARD_SHADOW: '#0f172a',
  WALL_SOFT: '#b45309', // Rusty orange
  WALL_SOFT_LIGHT: '#d97706',
  
  // Elements
  BOMB: '#111111',
  BOMB_HIGHLIGHT: '#ef4444', // Red pulsing light
  EXPLOSION_CENTER: '#fffbeb',
  EXPLOSION_OUTER: '#f59e0b', // Fire
  
  // Powerups
  POWERUP_BOMB: '#64748b', // Grey
  POWERUP_FLAME: '#f59e0b', // Gold
  POWERUP_SPEED: '#0ea5e9', // Sky Blue
  POWERUP_SUPER: '#dc2626', // Red
  POWERUP_TIME: '#8b5cf6', // Violet
  
  // Entities
  PLAYER_BODY: '#e2e8f0',
  PLAYER_ARMOR: '#475569',
  PLAYER_VISOR: '#06b6d4', // Cyan glowing eyes
  
  ENEMY_BASIC: '#9f1239', // Rose/Red Drone
  ENEMY_CHASER: '#4338ca', // Indigo Hunter
  ENEMY_BOSS: '#be123c', // Crimson Mech
};

export const DEBUG_MODE = false;
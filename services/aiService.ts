import { GridPoint, PathNode, TileType } from '../types';
import { GRID_COLS, GRID_ROWS } from '../constants';

// Manhattan distance heuristic
const heuristic = (a: GridPoint, b: GridPoint): number => {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
};

// Check if a tile is walkable
const isWalkable = (
  col: number, 
  row: number, 
  grid: number[][], 
  bombs: GridPoint[], 
  ignoreBombs: boolean
): boolean => {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  
  // Hard walls and Soft walls are obstacles
  if (grid[row][col] !== TileType.EMPTY) return false;

  // Bombs are obstacles (usually)
  if (!ignoreBombs) {
    for (const b of bombs) {
      if (b.col === col && b.row === row) return false;
    }
  }

  return true;
};

export const findPath = (
  start: GridPoint, 
  target: GridPoint, 
  grid: number[][], 
  bombs: GridPoint[] = []
): GridPoint[] | null => {
  const openSet: PathNode[] = [];
  const closedSet: Set<string> = new Set();
  
  openSet.push({ 
    x: start.col, 
    y: start.row, 
    g: 0, 
    h: heuristic(start, target), 
    f: heuristic(start, target), 
    parent: null 
  });

  // Safety break to prevent infinite loops in weird cases
  let iterations = 0;
  const MAX_ITERATIONS = 500; 

  while (openSet.length > 0) {
    iterations++;
    if (iterations > MAX_ITERATIONS) return null; // Path too complex or unreachable

    // Get node with lowest f score
    let lowestIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIndex].f) {
        lowestIndex = i;
      }
    }

    const current = openSet[lowestIndex];

    // Reached target?
    if (current.x === target.col && current.y === target.row) {
      const path: GridPoint[] = [];
      let temp: PathNode | null = current;
      while (temp) {
        path.push({ col: temp.x, row: temp.y });
        temp = temp.parent;
      }
      return path.reverse();
    }

    // Move current from open to closed
    openSet.splice(lowestIndex, 1);
    closedSet.add(`${current.x},${current.y}`);

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const neighbor of neighbors) {
      if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

      if (!isWalkable(neighbor.x, neighbor.y, grid, bombs, false)) continue;

      const gScore = current.g + 1;
      let gScoreIsBest = false;

      // check if neighbor is in openSet
      const existingNeighbor = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);

      if (!existingNeighbor) {
        gScoreIsBest = true;
        const h = heuristic({ col: neighbor.x, row: neighbor.y }, target);
        openSet.push({
          x: neighbor.x,
          y: neighbor.y,
          g: gScore,
          h: h,
          f: gScore + h,
          parent: current
        });
      } else if (gScore < existingNeighbor.g) {
        gScoreIsBest = true;
        existingNeighbor.g = gScore;
        existingNeighbor.f = existingNeighbor.g + existingNeighbor.h;
        existingNeighbor.parent = current;
      }
    }
  }

  return null; // No path found
};
import { 
  TILE_SIZE, GRID_ROWS, GRID_COLS, 
  COLORS, FPS, BOMB_TIMER_MS, EXPLOSION_DURATION_MS, 
  PLAYER_SPEED_BASE, ENEMY_SPEED_BASE, INVULNERABILITY_MS, DEBUG_MODE,
  CANVAS_WIDTH, CANVAS_HEIGHT
} from '../constants';
import { 
  Direction, TileType, Point, GridPoint, 
  PowerUpType, GameStats 
} from '../types';
import { audioService } from './audioService';
import { findPath } from './aiService';

// --- Interfaces for Engine Objects ---

interface Player {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  direction: Direction;
  isMoving: boolean;
  bombsCount: number;
  maxBombs: number;
  bombRange: number;
  speed: number;
  invulnerableUntil: number;
  isDead: boolean;
  animFrame: number; 
}

interface Bomb {
  id: number;
  col: number;
  row: number;
  timer: number;
  range: number;
  ownerId: string; 
}

interface Explosion {
  id: number;
  center: GridPoint;
  cells: { col: number, row: number, isEnd: boolean, direction: Direction }[];
  timer: number;
}

interface PowerUp {
  id: number;
  col: number;
  row: number;
  type: PowerUpType;
  bobOffset: number;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  type: 'WALKER' | 'CHASER';
  isBoss: boolean;
  hp: number; 
  maxHp: number;
  lastHitTime: number; 
  direction: Direction;
  targetCol: number | null; 
  targetRow: number | null;
  path: GridPoint[]; 
  recalcPathTimer: number;
  isDead: boolean;
  speed: number;
  animOffset: number; 
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private lastTime: number = 0;
  
  // Game State
  private grid: number[][] = [];
  private player: Player;
  private bombs: Bomb[] = [];
  private explosions: Explosion[] = [];
  private powerUps: PowerUp[] = [];
  private enemies: Enemy[] = [];
  
  private level: number = 1;
  private score: number = 0;
  private lives: number = 5; // INCREASED LIVES FOR EASIER GAMEPLAY
  private gameTime: number = 0;
  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private isVictory: boolean = false;
  private isLevelTransitioning: boolean = false;
  private isLevelComplete: boolean = false;

  private input = {
    up: false,
    down: false,
    left: false,
    right: false,
    bomb: false,
    bombPressed: false 
  };

  private onStatsUpdate: (stats: GameStats) => void;
  private onGameOver: (victory: boolean) => void;
  private onLevelComplete: () => void;

  constructor(
    canvas: HTMLCanvasElement, 
    onStatsUpdate: (stats: GameStats) => void,
    onGameOver: (victory: boolean) => void,
    onLevelComplete: () => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onStatsUpdate = onStatsUpdate;
    this.onGameOver = onGameOver;
    this.onLevelComplete = onLevelComplete;
    
    this.player = this.createPlayer();
    this.initLevel(1);
    
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public destroy() {
    audioService.stopMusic();
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  public startGame() {
    this.isPaused = false;
    this.lastTime = performance.now();
    audioService.init();
    audioService.startMusic();
    this.loop(this.lastTime);
  }

  public pauseGame(paused: boolean) {
    this.isPaused = paused;
    if (paused) audioService.stopMusic();
    else audioService.startMusic();
  }

  public restartGame() {
    this.level = 1;
    this.score = 0;
    this.lives = 5; // Reset lives to 5
    this.player = this.createPlayer();
    this.isGameOver = false;
    this.isVictory = false;
    this.isLevelTransitioning = false;
    this.isLevelComplete = false;
    this.initLevel(1);
    this.startGame();
  }

  // Called from UI to continue
  public proceedToNextLevel() {
      this.isLevelComplete = false;
      this.isLevelTransitioning = false;
      
      // BONUS LIFE for completing a level
      this.lives++;

      // Increased max levels to 10
      if (this.level >= 10) {
          this.isVictory = true;
          this.onGameOver(true);
          audioService.playVictory();
      } else {
          this.initLevel(this.level + 1);
          this.player.isMoving = false;
          // Stats update to ensure level number changes immediately on UI
          this.onStatsUpdate(this.getStats());
          this.startGame();
      }
  }

  // --- Input Handling ---

  private handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': this.input.up = true; break;
      case 'ArrowDown': case 's': case 'S': this.input.down = true; break;
      case 'ArrowLeft': case 'a': case 'A': this.input.left = true; break;
      case 'ArrowRight': case 'd': case 'D': this.input.right = true; break;
      case ' ': this.input.bomb = true; break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': this.input.up = false; break;
      case 'ArrowDown': case 's': case 'S': this.input.down = false; break;
      case 'ArrowLeft': case 'a': case 'A': this.input.left = false; break;
      case 'ArrowRight': case 'd': case 'D': this.input.right = false; break;
      case ' ': this.input.bomb = false; this.input.bombPressed = false; break;
    }
  };

  public setVirtualInput(key: string, pressed: boolean) {
    if (key === 'UP') this.input.up = pressed;
    if (key === 'DOWN') this.input.down = pressed;
    if (key === 'LEFT') this.input.left = pressed;
    if (key === 'RIGHT') this.input.right = pressed;
    if (key === 'BOMB') {
        this.input.bomb = pressed;
        if (!pressed) this.input.bombPressed = false;
    }
  }

  // --- Logic ---

  private createPlayer(): Player {
    return {
      x: TILE_SIZE,
      y: TILE_SIZE,
      gridX: 1,
      gridY: 1,
      direction: Direction.DOWN,
      isMoving: false,
      bombsCount: 0,
      maxBombs: 1,
      bombRange: 2,
      speed: PLAYER_SPEED_BASE,
      invulnerableUntil: 0,
      isDead: false,
      animFrame: 0
    };
  }

  private initLevel(level: number) {
    this.level = level;
    // Easier timer: 120s base + 15s per level
    this.gameTime = 120 + (level * 15); 
    this.grid = [];
    this.bombs = [];
    this.explosions = [];
    this.powerUps = [];
    this.enemies = [];
    this.isLevelTransitioning = false;
    this.isLevelComplete = false;

    // Set Dynamic Music
    audioService.setLevel(level);

    // 1. Generate Grid
    for (let r = 0; r < GRID_ROWS; r++) {
      const row: number[] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        if (r === 0 || c === 0 || r === GRID_ROWS - 1 || c === GRID_COLS - 1) {
          row.push(TileType.WALL_HARD);
        } else if (r % 2 === 0 && c % 2 === 0) {
          row.push(TileType.WALL_HARD);
        } else {
          const isSpawn = (r === 1 && c === 1) || (r === 1 && c === 2) || (r === 2 && c === 1);
          // Slightly less walls for easier movement
          const density = 0.25 + (level - 1) * 0.04;
          if (!isSpawn && Math.random() < Math.min(density, 0.6)) { 
            row.push(TileType.WALL_SOFT);
          } else {
            row.push(TileType.EMPTY);
          }
        }
      }
      this.grid.push(row);
    }

    this.player.x = TILE_SIZE;
    this.player.y = TILE_SIZE;
    this.player.invulnerableUntil = performance.now() + INVULNERABILITY_MS;

    // 2. Spawn Enemies - REDUCED COUNT
    // Formula: 2 + level (Level 1 = 3, Level 2 = 4...)
    let totalEnemies = 2 + Math.min(level, 8); 
    let enemiesSpawned = 0;
    
    while (enemiesSpawned < totalEnemies) {
        if (this.spawnEnemy(level)) {
            enemiesSpawned++;
        }
    }
  }

  private spawnEnemy(level: number): boolean {
      let attempts = 0;
      while(attempts < 50) {
        const r = Math.floor(Math.random() * (GRID_ROWS - 2)) + 1;
        const c = Math.floor(Math.random() * (GRID_COLS - 2)) + 1;
        
        const dist = Math.abs(r - 1) + Math.abs(c - 1);
        if (this.grid[r][c] === TileType.EMPTY && dist > 8) {
            
            // Determine if Boss should spawn
            // Level 1-2: No Boss
            // Level 3+: 20% chance per enemy, capped at 1 boss? 
            // Simplified: Only allow Boss type if level >= 3
            let isBoss = false;
            if (level >= 3 && Math.random() < 0.2) {
                // Ensure only 1 boss max per level usually, but loop random is fine for now
                isBoss = true;
            }

            const hp = isBoss ? 3 : 1; 
            const type = isBoss ? 'CHASER' : (Math.random() > 0.6 ? 'CHASER' : 'WALKER');
            
            // BALANCE FIX: Enemies only get speed boost starting from Level 5
            let speedMult = 1.0;
            if (level >= 5) {
                speedMult = 1.0 + (level - 4) * 0.08; // 8% faster per level after Lvl 5
            }

            const baseSpeed = isBoss ? ENEMY_SPEED_BASE * 1.15 : ENEMY_SPEED_BASE;
            const speed = baseSpeed * speedMult;

            this.enemies.push({
                id: Math.random(),
                x: c * TILE_SIZE,
                y: r * TILE_SIZE,
                type: type,
                isBoss: isBoss,
                hp: hp,
                maxHp: hp,
                lastHitTime: 0,
                direction: Math.random() > 0.5 ? Direction.LEFT : Direction.DOWN,
                targetCol: null,
                targetRow: null,
                path: [],
                recalcPathTimer: 0,
                isDead: false,
                speed: speed,
                animOffset: Math.random() * 100
            });
            return true;
        }
        attempts++;
      }
      return false;
  }

  private loop = (timestamp: number) => {
    if (!this.animationId && this.isPaused) return;

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (!this.isPaused && !this.isGameOver && !this.isVictory && !this.isLevelComplete) {
      this.update(deltaTime);
    }
    
    this.draw();
    this.animationId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    const now = performance.now();

    // 1. Player Movement
    let dx = 0;
    let dy = 0;
    if (this.input.up) dy = -1;
    else if (this.input.down) dy = 1;
    else if (this.input.left) dx = -1;
    else if (this.input.right) dx = 1;

    if (dx !== 0 && dy !== 0) {
      const invSqrt2 = 0.7071;
      dx *= invSqrt2;
      dy *= invSqrt2;
    }

    if (dx !== 0 || dy !== 0) {
      this.moveEntity(this.player, dx, dy, this.player.speed);
      this.player.isMoving = true;
      this.player.animFrame += dt * 0.01;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        this.player.direction = dx > 0 ? Direction.RIGHT : Direction.LEFT;
      } else {
        this.player.direction = dy > 0 ? Direction.DOWN : Direction.UP;
      }
    } else {
      this.player.isMoving = false;
      this.player.x = Math.round(this.player.x);
      this.player.y = Math.round(this.player.y);
    }

    this.player.gridX = Math.floor((this.player.x + TILE_SIZE / 2) / TILE_SIZE);
    this.player.gridY = Math.floor((this.player.y + TILE_SIZE / 2) / TILE_SIZE);

    // 2. Bomb Placement
    if (this.input.bomb && !this.input.bombPressed) {
      this.input.bombPressed = true;
      this.placeBomb();
    }

    // 3. Update Bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.timer -= dt;
      if (bomb.timer <= 0) {
        this.explodeBomb(bomb);
        this.bombs.splice(i, 1);
        if (bomb.ownerId === 'player') this.player.bombsCount--;
      }
    }

    // 4. Update Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.timer -= dt;
      
      exp.cells.forEach(cell => {
         // Check Player Hit
         const playerCenterCol = Math.floor((this.player.x + TILE_SIZE / 2) / TILE_SIZE);
         const playerCenterRow = Math.floor((this.player.y + TILE_SIZE / 2) / TILE_SIZE);
         if (playerCenterCol === cell.col && playerCenterRow === cell.row) {
            this.killPlayer();
         }

         // Check Enemy Hit
         this.enemies.forEach(enemy => {
           const enemyCol = Math.floor((enemy.x + TILE_SIZE / 2) / TILE_SIZE);
           const enemyRow = Math.floor((enemy.y + TILE_SIZE / 2) / TILE_SIZE);
           if (enemyCol === cell.col && enemyRow === cell.row && !enemy.isDead) {
             
             if (enemy.isBoss && (now - enemy.lastHitTime < 1000)) {
                 return; 
             }

             enemy.hp--;
             enemy.lastHitTime = now;

             if (enemy.hp <= 0) {
                enemy.isDead = true;
                this.score += enemy.isBoss ? 500 : 100;
                this.gameTime += enemy.isBoss ? 30 : 10;
                audioService.playDeath();
             } else {
                audioService.playBossHit();
             }
           }
         });
      });

      if (exp.timer <= 0) {
        this.explosions.splice(i, 1);
      }
    }

    // 5. Update Enemies
    this.enemies = this.enemies.filter(e => !e.isDead);
    
    // Check Level Complete Condition
    if (this.enemies.length === 0 && !this.isVictory && !this.isLevelTransitioning && !this.isLevelComplete) {
       this.isLevelComplete = true;
       audioService.playLevelClear();
       this.onLevelComplete();
    }
    
    if (!this.isLevelComplete) {
      this.enemies.forEach(enemy => this.updateEnemyAI(enemy, dt));
    }

    // 6. Check PowerUps
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      if (this.player.gridX === p.col && this.player.gridY === p.row) {
        this.applyPowerUp(p);
        this.powerUps.splice(i, 1);
        audioService.playPowerUp();
      }
    }

    // 7. Check Player-Enemy Collision
    if (this.player.invulnerableUntil < now) {
      this.enemies.forEach(e => {
        const dist = Math.hypot(this.player.x - e.x, this.player.y - e.y);
        if (dist < TILE_SIZE * 0.7) {
          this.killPlayer();
        }
      });
    }

    // Stats Update
    if (Math.floor(now / 1000) !== Math.floor((now - dt) / 1000)) {
        this.gameTime--;
        if (this.gameTime <= 0) this.killPlayer();
    }
    
    this.onStatsUpdate({
      score: this.score,
      lives: this.lives,
      level: this.level,
      timeLeft: Math.max(0, this.gameTime)
    });
  }

  private isPointBlocked(x: number, y: number): boolean {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return true;
    if (this.grid[row][col] !== TileType.EMPTY) return true;
    
    // Simple bomb check for sliding: treat bombs as walls 
    for (const b of this.bombs) {
      if (b.col === col && b.row === row) return true;
    }
    return false;
  }

  private moveEntity(entity: {x: number, y: number}, dx: number, dy: number, speed: number) {
    // Increase hitbox slack for smoother cornering (48px tile, 32px hitbox = 16px slack)
    const padding = 8; 
    const size = TILE_SIZE - padding * 2;
    
    const nextX = entity.x + dx * speed;
    const nextY = entity.y + dy * speed;

    // Horizontal Movement
    if (!this.checkCollision(nextX + padding, entity.y + padding, size, size, entity === this.player)) {
      entity.x = nextX;
    } else if (entity === this.player && dx !== 0) {
       // Smart Corner Sliding (X-Axis)
       // If we hit a wall but are partially open to a lane, slide vertically into it
       const leadingEdgeX = dx > 0 ? nextX + padding + size : nextX + padding;
       const topY = entity.y + padding;
       const bottomY = entity.y + padding + size;
       
       const topBlocked = this.isPointBlocked(leadingEdgeX, topY);
       const bottomBlocked = this.isPointBlocked(leadingEdgeX, bottomY);

       if (topBlocked && !bottomBlocked) {
         entity.y += speed; // Slide Down
       } else if (!topBlocked && bottomBlocked) {
         entity.y -= speed; // Slide Up
       }
    }

    // Vertical Movement
    if (!this.checkCollision(entity.x + padding, nextY + padding, size, size, entity === this.player)) {
      entity.y = nextY;
    } else if (entity === this.player && dy !== 0) {
       // Smart Corner Sliding (Y-Axis)
       const leadingEdgeY = dy > 0 ? nextY + padding + size : nextY + padding;
       const leftX = entity.x + padding;
       const rightX = entity.x + padding + size;
       
       const leftBlocked = this.isPointBlocked(leftX, leadingEdgeY);
       const rightBlocked = this.isPointBlocked(rightX, leadingEdgeY);

       if (leftBlocked && !rightBlocked) {
         entity.x += speed; // Slide Right
       } else if (!leftBlocked && rightBlocked) {
         entity.x -= speed; // Slide Left
       }
    }
    
    // Bounds Check
    entity.x = Math.max(0, Math.min(entity.x, CANVAS_WIDTH - TILE_SIZE));
    entity.y = Math.max(0, Math.min(entity.y, CANVAS_HEIGHT - TILE_SIZE));
  }

  private checkCollision(x: number, y: number, w: number, h: number, isPlayer: boolean): boolean {
    const corners = [
      { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) },
      { col: Math.floor((x + w) / TILE_SIZE), row: Math.floor(y / TILE_SIZE) },
      { col: Math.floor(x / TILE_SIZE), row: Math.floor((y + h) / TILE_SIZE) },
      { col: Math.floor((x + w) / TILE_SIZE), row: Math.floor((y + h) / TILE_SIZE) }
    ];

    for (const p of corners) {
      if (p.row < 0 || p.row >= GRID_ROWS || p.col < 0 || p.col >= GRID_COLS) return true;
      
      const tile = this.grid[p.row][p.col];
      if (tile !== TileType.EMPTY) return true;

      for (const bomb of this.bombs) {
        if (bomb.col === p.col && bomb.row === p.row) {
          if (isPlayer) {
             const padding = 8; // Match the new smaller hitbox padding
             const playerRect = {
                 x: this.player.x + padding,
                 y: this.player.y + padding,
                 w: TILE_SIZE - padding * 2,
                 h: TILE_SIZE - padding * 2
             };
             const bombRect = {
                 x: bomb.col * TILE_SIZE,
                 y: bomb.row * TILE_SIZE,
                 w: TILE_SIZE,
                 h: TILE_SIZE
             };
             const overlaps = (
                 playerRect.x < bombRect.x + bombRect.w &&
                 playerRect.x + playerRect.w > bombRect.x &&
                 playerRect.y < bombRect.y + bombRect.h &&
                 playerRect.y + playerRect.h > bombRect.y
             );
             if (overlaps) continue; // Allow moving if already inside
          }
          return true;
        }
      }
    }
    return false;
  }

  private placeBomb() {
    if (this.player.bombsCount >= this.player.maxBombs) return;
    const col = Math.floor((this.player.x + TILE_SIZE / 2) / TILE_SIZE);
    const row = Math.floor((this.player.y + TILE_SIZE / 2) / TILE_SIZE);
    if (this.bombs.some(b => b.col === col && b.row === row)) return;

    this.bombs.push({
      id: Math.random(),
      col,
      row,
      timer: 2000,
      range: this.player.bombRange,
      ownerId: 'player'
    });
    this.player.bombsCount++;
    audioService.playBombPlace();
  }

  private explodeBomb(bomb: Bomb) {
    audioService.playExplosion();
    const cells: { col: number, row: number, isEnd: boolean, direction: Direction }[] = [];
    cells.push({ col: bomb.col, row: bomb.row, isEnd: false, direction: Direction.NONE }); 

    const directions = [
      { dx: 0, dy: -1, dir: Direction.UP },
      { dx: 0, dy: 1, dir: Direction.DOWN },
      { dx: -1, dy: 0, dir: Direction.LEFT },
      { dx: 1, dy: 0, dir: Direction.RIGHT }
    ];

    directions.forEach(({ dx, dy, dir }) => {
      for (let i = 1; i <= bomb.range; i++) {
        const c = bomb.col + dx * i;
        const r = bomb.row + dy * i;
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) break;
        const tile = this.grid[r][c];
        
        if (tile === TileType.WALL_HARD) break;
        cells.push({ col: c, row: r, isEnd: i === bomb.range, direction: dir });
        
        const hitBombIdx = this.bombs.findIndex(b => b.col === c && b.row === r);
        if (hitBombIdx !== -1) {
          const hitBomb = this.bombs[hitBombIdx];
          hitBomb.timer = 0; 
          break; 
        }

        if (tile === TileType.WALL_SOFT) {
          this.destroyBlock(c, r);
          break; 
        }
      }
    });

    this.explosions.push({
      id: Math.random(),
      center: { col: bomb.col, row: bomb.row },
      cells,
      timer: EXPLOSION_DURATION_MS
    });
  }

  private destroyBlock(col: number, row: number) {
    this.grid[row][col] = TileType.EMPTY;
    this.score += 10;
    if (Math.random() < 0.35) {
      const rand = Math.random();
      let type = PowerUpType.BOMB_UP;
      
      // Adjusted weights for new items
      if (rand > 0.60) type = PowerUpType.FIRE_UP;
      if (rand > 0.80) type = PowerUpType.SPEED_UP;
      if (rand > 0.90) type = PowerUpType.TIME_BONUS;
      if (rand > 0.96) type = PowerUpType.SUPER_BOMB; // Rare

      this.powerUps.push({
        id: Math.random(),
        col,
        row,
        type,
        bobOffset: Math.random() * 10
      });
    }
  }

  private applyPowerUp(p: PowerUp) {
    this.score += 50;
    switch (p.type) {
      case PowerUpType.BOMB_UP: 
        this.player.maxBombs++; 
        break;
      case PowerUpType.FIRE_UP: 
        this.player.bombRange++; 
        break;
      case PowerUpType.SPEED_UP: 
        this.player.speed = Math.min(this.player.speed + 1, 9); 
        break;
      case PowerUpType.SUPER_BOMB:
        this.player.bombRange = 12; // Massive range
        break;
      case PowerUpType.TIME_BONUS:
        this.gameTime += 30;
        break;
    }
  }

  private killPlayer() {
    if (this.player.invulnerableUntil > performance.now() || this.player.isDead) return;
    this.lives--;
    audioService.playDeath();
    this.player.isDead = true;

    if (this.lives <= 0) {
      this.isGameOver = true;
      audioService.stopMusic();
      this.onGameOver(false);
    } else {
      setTimeout(() => {
        this.player.x = TILE_SIZE;
        this.player.y = TILE_SIZE;
        this.player.isDead = false;
        this.player.invulnerableUntil = performance.now() + 3000;
        this.onStatsUpdate({ ...this.getStats(), lives: this.lives });
      }, 1000);
    }
  }

  private updateEnemyAI(enemy: Enemy, dt: number) {
      enemy.recalcPathTimer -= dt;
      
      // BALANCE FIX: Reaction time only decreases after Level 5
      // Level 1-4: 1500ms (Slow/Normal)
      // Level 5+: Drops by 200ms per level
      let reactionBase = 1500;
      if (this.level >= 5) {
         reactionBase -= (this.level - 4) * 200;
      }
      const reactionTime = enemy.isBoss ? 400 : Math.max(400, reactionBase);

      if (enemy.path.length > 0) {
          const nextStep = enemy.path[0];
          if (this.bombs.some(b => b.col === nextStep.col && b.row === nextStep.row)) {
             enemy.path = []; 
             return;
          }

          const targetX = nextStep.col * TILE_SIZE;
          const targetY = nextStep.row * TILE_SIZE;
          const distSq = (enemy.x - targetX) ** 2 + (enemy.y - targetY) ** 2;

          if (distSq < 16) { 
              enemy.x = targetX;
              enemy.y = targetY;
              enemy.path.shift(); 
              
              if (enemy.path.length === 0) enemy.recalcPathTimer = 0; 
              return;
          }

          let dx = 0; let dy = 0;
          if (Math.abs(enemy.x - targetX) > 1) dx = targetX > enemy.x ? 1 : -1;
          if (Math.abs(enemy.y - targetY) > 1) dy = targetY > enemy.y ? 1 : -1;

          if (dx !== 0 && dy !== 0) {
              if (Math.abs(enemy.x - targetX) > Math.abs(enemy.y - targetY)) dy = 0;
              else dx = 0;
          }
          this.moveEntity(enemy, dx, dy, enemy.speed);
      } else {
          const gridCol = Math.round(enemy.x / TILE_SIZE);
          const gridRow = Math.round(enemy.y / TILE_SIZE);
          const centerX = gridCol * TILE_SIZE;
          const centerY = gridRow * TILE_SIZE;
          const distSq = (enemy.x - centerX) ** 2 + (enemy.y - centerY) ** 2;
          
          if (distSq > 4) {
             let dx = 0; let dy = 0;
             if (Math.abs(enemy.x - centerX) > 1) dx = centerX > enemy.x ? 1 : -1;
             if (Math.abs(enemy.y - centerY) > 1) dy = centerY > enemy.y ? 1 : -1;
             this.moveEntity(enemy, dx, dy, enemy.speed);
          } else {
             enemy.x = centerX;
             enemy.y = centerY;

             if (enemy.recalcPathTimer <= 0) {
                // Boss thinks a bit slower now
                const delay = enemy.isBoss ? 500 : 300;
                enemy.recalcPathTimer = reactionTime + delay + Math.random() * 200;
                
                const start = { col: gridCol, row: gridRow };
                let target: GridPoint | null = null;
                
                if (enemy.type === 'CHASER') {
                     target = { col: this.player.gridX, row: this.player.gridY };
                 } else {
                     const neighbors = [
                       { col: gridCol + 1, row: gridRow }, { col: gridCol - 1, row: gridRow },
                       { col: gridCol, row: gridRow + 1 }, { col: gridCol, row: gridRow - 1 },
                       { col: gridCol + 2, row: gridRow }, { col: gridCol - 2, row: gridRow },
                       { col: gridCol, row: gridRow + 2 }, { col: gridCol, row: gridRow - 2 },
                     ];
                     const valid = neighbors.filter(n => 
                        n.col >= 0 && n.col < GRID_COLS && n.row >= 0 && n.row < GRID_ROWS &&
                        this.grid[n.row][n.col] === TileType.EMPTY &&
                        !this.bombs.some(b => b.col === n.col && b.row === n.row)
                     );
                     if (valid.length > 0) target = valid[Math.floor(Math.random() * valid.length)];
                 }

                if (target) {
                    const bombPoints = this.bombs.map(b => ({col: b.col, row: b.row}));
                    const path = findPath(start, target, this.grid, bombPoints);
                    if (path && path.length > 0) {
                        enemy.path = path;
                        if (enemy.path.length > 0 && enemy.path[0].col === gridCol && enemy.path[0].row === gridRow) {
                           enemy.path.shift();
                        }
                    }
                }
             }
          }
      }
  }

  private nextLevel() {
      if (this.level >= 5) {
          this.isVictory = true;
          this.onGameOver(true);
          audioService.playVictory();
      } else {
          this.initLevel(this.level + 1);
          this.player.isMoving = false;
      }
  }

  private getStats(): GameStats {
      return { score: this.score, lives: this.lives, level: this.level, timeLeft: this.gameTime };
  }

  // --- Rendering ---

  private draw() {
    // 1. Map Background
    this.ctx.fillStyle = COLORS.BG;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Industrial Grid Lines
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for(let i=0; i<=GRID_COLS; i++) {
        this.ctx.moveTo(i*TILE_SIZE, 0); this.ctx.lineTo(i*TILE_SIZE, CANVAS_HEIGHT);
    }
    for(let i=0; i<=GRID_ROWS; i++) {
        this.ctx.moveTo(0, i*TILE_SIZE); this.ctx.lineTo(CANVAS_WIDTH, i*TILE_SIZE);
    }
    this.ctx.stroke();

    // 2. Walls
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        const type = this.grid[r][c];

        if (type === TileType.WALL_HARD) {
          // Metal Plate Look
          this.ctx.fillStyle = COLORS.WALL_HARD;
          this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          
          this.ctx.fillStyle = '#1e293b'; // Dark bolts
          this.ctx.fillRect(x+2, y+2, 4, 4);
          this.ctx.fillRect(x+TILE_SIZE-6, y+2, 4, 4);
          this.ctx.fillRect(x+2, y+TILE_SIZE-6, 4, 4);
          this.ctx.fillRect(x+TILE_SIZE-6, y+TILE_SIZE-6, 4, 4);
          
          this.ctx.strokeStyle = '#475569';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(x+4, y+4, TILE_SIZE-8, TILE_SIZE-8);
          
          // Cross hatch
          this.ctx.beginPath();
          this.ctx.moveTo(x+4, y+4); this.ctx.lineTo(x+TILE_SIZE-4, y+TILE_SIZE-4);
          this.ctx.stroke();

        } else if (type === TileType.WALL_SOFT) {
          // Rusty Crate Look
          this.ctx.fillStyle = COLORS.WALL_SOFT;
          this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          
          this.ctx.fillStyle = COLORS.WALL_SOFT_LIGHT;
          this.ctx.fillRect(x+4, y+4, TILE_SIZE-8, TILE_SIZE-8);
          
          this.ctx.fillStyle = COLORS.WALL_SOFT; // Inner detail
          this.ctx.fillRect(x+10, y+10, TILE_SIZE-20, TILE_SIZE-20);
          
          // Warning stripe
          this.ctx.fillStyle = '#000000';
          this.ctx.fillRect(x+4, y+TILE_SIZE/2 - 2, TILE_SIZE-8, 4);
        }
      }
    }

    // 3. PowerUps
    this.powerUps.forEach(p => {
       const bob = Math.sin(performance.now() * 0.005 + p.bobOffset) * 2;
       const x = p.col * TILE_SIZE + 6;
       const y = p.row * TILE_SIZE + 6 + bob;
       const s = TILE_SIZE - 12;
       
       let color = '#ccc';
       let label = '?';

       switch (p.type) {
           case PowerUpType.BOMB_UP: color = COLORS.POWERUP_BOMB; label = 'B'; break;
           case PowerUpType.FIRE_UP: color = COLORS.POWERUP_FLAME; label = 'F'; break;
           case PowerUpType.SPEED_UP: color = COLORS.POWERUP_SPEED; label = '⚡'; break;
           case PowerUpType.SUPER_BOMB: color = COLORS.POWERUP_SUPER; label = 'S'; break;
           case PowerUpType.TIME_BONUS: color = COLORS.POWERUP_TIME; label = 'T'; break;
       }

       this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
       this.ctx.fillRect(x+4, y+4, s, s); // Shadow

       this.ctx.fillStyle = color;
       this.ctx.fillRect(x, y, s, s);
       
       this.ctx.strokeStyle = '#fff';
       this.ctx.lineWidth = 2;
       this.ctx.strokeRect(x, y, s, s);

       this.ctx.fillStyle = '#fff';
       this.ctx.font = '900 20px "Courier New", monospace';
       this.ctx.textAlign = 'center';
       this.ctx.textBaseline = 'middle';
       this.ctx.fillText(label, x + s/2, y + s/2 + 1);
    });

    // 4. Bombs
    this.bombs.forEach(b => {
       const x = b.col * TILE_SIZE + TILE_SIZE/2;
       const y = b.row * TILE_SIZE + TILE_SIZE/2;
       const pulse = Math.sin(performance.now() * 0.015);
       
       // C4 / Mine look
       this.ctx.fillStyle = COLORS.BOMB;
       this.ctx.beginPath(); 
       this.ctx.rect(x-14, y-14, 28, 28); // Square base
       this.ctx.fill();
       
       // Tech border
       this.ctx.strokeStyle = '#444';
       this.ctx.lineWidth = 2;
       this.ctx.strokeRect(x-14, y-14, 28, 28);

       // LED Center
       this.ctx.fillStyle = pulse > 0 ? COLORS.BOMB_HIGHLIGHT : '#500';
       this.ctx.beginPath();
       this.ctx.arc(x, y, 6, 0, Math.PI * 2);
       this.ctx.fill();

       // Timer ring
       this.ctx.strokeStyle = COLORS.BOMB_HIGHLIGHT;
       this.ctx.lineWidth = 2;
       this.ctx.beginPath();
       this.ctx.arc(x, y, 10, 0, (b.timer / BOMB_TIMER_MS) * Math.PI * 2);
       this.ctx.stroke();
    });

    // 5. Enemies (Sci-Fi/Robotic)
    this.enemies.forEach(e => {
        // Boss Hit flash
        if (e.isBoss && (performance.now() - e.lastHitTime < 1000) && Math.floor(performance.now()/80)%2===0) {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = '#fff';
        } else {
            this.ctx.fillStyle = e.type === 'CHASER' ? COLORS.ENEMY_CHASER : COLORS.ENEMY_BASIC;
            if (e.isBoss) this.ctx.fillStyle = COLORS.ENEMY_BOSS;
        }

        const cx = e.x + TILE_SIZE/2;
        const cy = e.y + TILE_SIZE/2;
        
        if (e.isBoss) {
            // MECH BOSS
            this.ctx.fillRect(cx - 20, cy - 20, 40, 30); // Main Chassis
            this.ctx.fillStyle = '#333'; // Treads
            this.ctx.fillRect(cx - 24, cy - 10, 8, 30);
            this.ctx.fillRect(cx + 16, cy - 10, 8, 30);
            
            // Cockpit glass
            this.ctx.fillStyle = '#facc15';
            this.ctx.fillRect(cx - 8, cy - 14, 16, 8);

            // Cannon
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(cx - 4, cy + 10, 8, 12);

            // Boss HP Bar
            const hpPct = e.hp / e.maxHp;
            this.ctx.fillStyle = 'red';
            this.ctx.fillRect(cx-20, cy-35, 40, 4);
            this.ctx.fillStyle = '#0f0';
            this.ctx.fillRect(cx-20, cy-35, 40 * hpPct, 4);

        } else if (e.type === 'CHASER') {
            // CYBORG / DRONE
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 14, 0, Math.PI*2);
            this.ctx.fill();
            
            // Glowing Eye
            this.ctx.fillStyle = '#67e8f9';
            this.ctx.beginPath();
            this.ctx.moveTo(cx-8, cy-4); this.ctx.lineTo(cx+8, cy-4); this.ctx.lineTo(cx, cy+6);
            this.ctx.fill();

            // Spikes
            this.ctx.strokeStyle = '#312e81';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(cx-14, cy); this.ctx.lineTo(cx-20, cy);
            this.ctx.moveTo(cx+14, cy); this.ctx.lineTo(cx+20, cy);
            this.ctx.stroke();

        } else {
            // WALKER BOT
            this.ctx.fillRect(cx - 12, cy - 12, 24, 20);
            
            // Legs (simple stick)
            const legOffset = Math.sin(performance.now()*0.02) * 4;
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(cx - 10, cy + 8, 4, 10 + legOffset);
            this.ctx.fillRect(cx + 6, cy + 8, 4, 10 - legOffset);
            
            // Red Visor
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(cx - 8, cy - 6, 16, 4);
            this.ctx.fillStyle = 'red';
            this.ctx.fillRect(cx - 4 + Math.sin(performance.now()*0.01)*4, cy - 6, 4, 4); // Scanning eye
        }
    });

    // 6. Player (Cyber-Soldier)
    if (!this.player.isDead) {
        if (this.player.invulnerableUntil < performance.now() || Math.floor(performance.now() / 100) % 2 === 0) {
            const cx = this.player.x + TILE_SIZE / 2;
            const cy = this.player.y + TILE_SIZE / 2;
            
            // Shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
            this.ctx.beginPath(); this.ctx.ellipse(cx, cy+18, 12, 4, 0, 0, Math.PI*2); this.ctx.fill();

            // Armor Body
            this.ctx.fillStyle = COLORS.PLAYER_ARMOR;
            this.ctx.fillRect(cx - 10, cy - 10, 20, 20);
            
            // Helmet
            this.ctx.fillStyle = COLORS.PLAYER_BODY;
            this.ctx.beginPath(); 
            this.ctx.arc(cx, cy - 14, 10, 0, Math.PI*2); 
            this.ctx.fill();

            // Tactical Visor (Glowing)
            this.ctx.fillStyle = COLORS.PLAYER_VISOR;
            this.ctx.fillRect(cx - 8, cy - 16, 16, 5);
            
            // Backpack (Bomb storage)
            this.ctx.fillStyle = '#334155';
            this.ctx.fillRect(cx - 12, cy - 12, 4, 16);
            this.ctx.fillRect(cx + 8, cy - 12, 4, 16);

            // Limbs
            this.ctx.fillStyle = COLORS.PLAYER_BODY;
            const handSwing = this.player.isMoving ? Math.sin(this.player.animFrame * 15) * 8 : 0;
            // Hands
            this.ctx.beginPath(); this.ctx.arc(cx - 14, cy + handSwing, 5, 0, Math.PI*2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.arc(cx + 14, cy - handSwing, 5, 0, Math.PI*2); this.ctx.fill();
            // Feet
            const footStep = this.player.isMoving ? Math.cos(this.player.animFrame * 15) * 6 : 0;
            this.ctx.fillStyle = '#1e293b'; // Boots
            this.ctx.fillRect(cx - 8, cy + 10 + footStep, 6, 8);
            this.ctx.fillRect(cx + 2, cy + 10 - footStep, 6, 8);
        }
    }

    // 7. Explosions (Top Layer)
    this.explosions.forEach(exp => {
        const alpha = Math.max(0, exp.timer / EXPLOSION_DURATION_MS);
        this.ctx.globalAlpha = alpha;
        exp.cells.forEach(cell => {
            const x = cell.col * TILE_SIZE;
            const y = cell.row * TILE_SIZE;
            
            this.ctx.fillStyle = COLORS.EXPLOSION_OUTER;
            this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            
            // Plasma core
            this.ctx.fillStyle = COLORS.EXPLOSION_CENTER;
            this.ctx.beginPath();
            this.ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/2 - 4, 0, Math.PI*2);
            this.ctx.fill();
            
            // Spark lines
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y); this.ctx.lineTo(x+TILE_SIZE, y+TILE_SIZE);
            this.ctx.moveTo(x+TILE_SIZE, y); this.ctx.lineTo(x, y+TILE_SIZE);
            this.ctx.stroke();
        });
        this.ctx.globalAlpha = 1.0;
    });
  }
}
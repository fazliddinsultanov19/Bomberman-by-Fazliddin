import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../services/gameEngine';
import { CANVAS_HEIGHT, CANVAS_WIDTH, TILE_SIZE } from '../constants';
import { GameStats } from '../types';

interface GameCanvasProps {
  onStatsUpdate: (stats: GameStats) => void;
  onGameOver: (victory: boolean) => void;
  onLevelComplete: () => void;
  paused: boolean;
  active: boolean; // Is game active
}

// Global ref to access engine for mobile controls
export let globalGameEngine: GameEngine | null = null;

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  onStatsUpdate, onGameOver, onLevelComplete, paused, active 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !active) return;

    // Init Engine
    const engine = new GameEngine(
      canvasRef.current,
      onStatsUpdate,
      onGameOver,
      onLevelComplete
    );
    engineRef.current = engine;
    globalGameEngine = engine;

    engine.startGame();

    return () => {
      engine.destroy();
      engineRef.current = null;
      globalGameEngine = null;
    };
  }, [active]); // Re-init if active toggles (Restart)

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.pauseGame(paused);
    }
  }, [paused]);

  // Scale canvas for high DPI
  const scale = typeof window !== 'undefined' ? Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT) : 1;
  // Cap scale at 1.5 to not look too blurry if screen is huge
  const finalScale = Math.min(scale, 1.5);

  return (
    <div className="relative flex justify-center items-center h-full w-full">
        <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="bg-neutral-800"
            style={{
                width: `${CANVAS_WIDTH}px`,
                height: `${CANVAS_HEIGHT}px`,
                transform: `scale(${finalScale * 0.95})`, 
                transformOrigin: 'center'
            }}
        />
        <div className="absolute bottom-2 right-2 text-white/30 text-[10px] font-mono select-none pointer-events-none z-0">
            Created by Fazliddin
        </div>
    </div>
  );
};
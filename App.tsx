import React, { useState, useCallback } from 'react';
import { GameCanvas, globalGameEngine } from './components/GameCanvas';
import { MobileControls } from './components/MobileControls';
import { GameStats, GameState } from './types';
import { audioService } from './services/audioService';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState<GameStats>({ score: 0, lives: 3, level: 1, timeLeft: 70 });
  const [key, setKey] = useState(0); // Force re-render of canvas on restart
  const [isPaused, setIsPaused] = useState(false);
  const [username, setUsername] = useState('AGENT');
  const [tempUsername, setTempUsername] = useState('');

  const startGame = () => {
    if (tempUsername.trim().length > 0) {
        setUsername(tempUsername.trim().toUpperCase());
    }
    audioService.init(); // Initialize audio context on user gesture
    setGameState(GameState.PLAYING);
    setIsPaused(false);
    setKey(k => k + 1);
  };

  const handleStatsUpdate = useCallback((newStats: GameStats) => {
    setStats(newStats);
  }, []);

  const handleGameOver = useCallback((victory: boolean) => {
    setGameState(victory ? GameState.VICTORY : GameState.GAME_OVER);
  }, []);

  const handleLevelComplete = useCallback(() => {
    setGameState(GameState.LEVEL_COMPLETE);
  }, []);

  const nextLevel = () => {
    setGameState(GameState.PLAYING);
    globalGameEngine?.proceedToNextLevel();
  };

  const togglePause = () => {
      setIsPaused(!isPaused);
  };

  return (
    <div className="w-screen h-screen bg-slate-900 text-white flex flex-col overflow-hidden font-sans select-none">
      
      {/* Header / HUD */}
      {gameState !== GameState.MENU && (
        <div className="flex-none h-20 bg-slate-900/90 backdrop-blur-lg border-b border-indigo-500/30 flex justify-between items-center px-4 md:px-8 z-10 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
          
          {/* Left Stats */}
          <div className="flex gap-4 items-center">
             <div className="flex flex-col items-center bg-slate-800/80 rounded-xl px-4 py-2 border border-slate-700 shadow-inner min-w-[100px]">
                 <span className="text-[9px] text-indigo-300 uppercase tracking-widest font-bold mb-1">OPERATOR</span>
                 <span className="text-sm font-bold text-white truncate max-w-[120px]">{username}</span>
             </div>

             <div className="flex flex-col items-center bg-slate-800/80 rounded-xl px-4 py-2 border border-slate-700 shadow-inner">
                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold mb-1">Time</span>
                <span className={`text-2xl font-mono font-black ${stats.timeLeft < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{stats.timeLeft}s</span>
             </div>
             <div className="flex flex-col items-center bg-slate-800/80 rounded-xl px-4 py-2 border border-slate-700 shadow-inner">
                <span className="text-[10px] text-pink-400 uppercase tracking-widest font-bold mb-1">Lives</span>
                <div className="flex gap-1 h-8 items-center">
                  {Array.from({length: Math.max(0, stats.lives)}).map((_, i) => (
                    <span key={i} className="text-xl text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">♥</span>
                  ))}
                </div>
             </div>
          </div>
          
          {/* Center Level Indicator */}
          <div className="flex flex-col items-center justify-center transform -skew-x-12 bg-indigo-600 px-8 py-2 rounded shadow-lg border-2 border-indigo-400">
             <span className="text-sm font-bold text-indigo-200 uppercase tracking-wider skew-x-12">Mission</span>
             <span className="text-3xl font-black text-white italic tracking-tighter drop-shadow-md skew-x-12">LEVEL {stats.level}</span>
          </div>

          {/* Right Stats & Pause */}
          <div className="flex gap-4 items-center">
             <div className="flex flex-col items-end bg-slate-800/80 rounded-xl px-4 py-2 border border-slate-700 shadow-inner min-w-[120px]">
                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-1">Score</span>
                <span className="text-2xl font-mono font-black text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">{stats.score.toString().padStart(6, '0')}</span>
             </div>
             <button 
               onClick={togglePause}
               className="ml-2 w-12 h-12 rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center hover:bg-white/20 hover:border-white/50 transition-all active:scale-95 group"
             >
               {isPaused ? <span className="text-2xl pl-1 group-hover:text-yellow-300">▶</span> : <span className="text-xl font-black group-hover:text-yellow-300">||</span>}
             </button>
          </div>
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 relative bg-slate-950 flex justify-center items-center overflow-hidden">
        
        {/* Decorative Grid BG */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black pointer-events-none"></div>
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>

        {/* Game Canvas */}
        <div className="relative z-10 shadow-2xl shadow-black/50 rounded-lg overflow-hidden border-4 border-slate-800">
          <GameCanvas 
             key={key}
             active={gameState !== GameState.MENU}
             paused={isPaused}
             onStatsUpdate={handleStatsUpdate}
             onGameOver={handleGameOver}
             onLevelComplete={handleLevelComplete}
          />
        </div>

        {/* Mobile Controls Overlay */}
        {gameState === GameState.PLAYING && !isPaused && (
           <div className="md:hidden"> 
              <MobileControls />
           </div>
        )}

        {/* Start Menu Overlay */}
        {gameState === GameState.MENU && (
          <div className="absolute inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center p-6">
            <div className="relative mb-4 group cursor-default">
              <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-600 drop-shadow-[0_4px_0_rgba(180,83,9,1)] tracking-tighter transform hover:scale-105 transition-transform duration-300">
                BOMBER<br/>MANIA
              </h1>
              <div className="absolute -inset-2 bg-orange-500/20 blur-xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity"></div>
            </div>
            
            <p className="text-slate-400 mb-8 font-mono text-sm tracking-widest uppercase border-b border-slate-700 pb-2">
               Created by Fazliddin
            </p>

            <div className="w-full max-w-sm mb-8">
               <label className="block text-xs uppercase text-indigo-400 font-bold mb-2 tracking-wider ml-1">Identify Yourself</label>
               <input 
                  type="text" 
                  placeholder="ENTER AGENT NAME"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  maxLength={12}
                  className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl px-4 py-3 text-center text-white font-mono text-lg tracking-widest focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all placeholder:text-slate-600 uppercase"
               />
            </div>
            
            <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full mb-8 transform hover:-translate-y-1 transition-transform duration-300">
              <h3 className="text-lg font-bold text-indigo-300 mb-4 flex items-center gap-2">
                <span className="w-2 h-5 bg-indigo-500 rounded-sm"></span>
                MISSION BRIEFING
              </h3>
              <ul className="text-sm text-slate-300 space-y-3 font-medium">
                <li className="flex justify-between items-center group">
                  <span className="text-slate-400 group-hover:text-white transition-colors">Move</span> 
                  <span className="font-mono text-xs text-indigo-200 bg-indigo-900/50 px-3 py-1 rounded border border-indigo-500/30">WASD / ARROWS</span>
                </li>
                <li className="flex justify-between items-center group">
                  <span className="text-slate-400 group-hover:text-white transition-colors">Bomb</span> 
                  <span className="font-mono text-xs text-orange-200 bg-orange-900/50 px-3 py-1 rounded border border-orange-500/30">SPACEBAR</span>
                </li>
                <li className="pt-2 border-t border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-400">Objective</span> 
                  <span className="text-yellow-400 font-bold animate-pulse">DEFEAT BOSS & ENEMIES</span>
                </li>
              </ul>
            </div>

            <button 
              onClick={startGame}
              className="relative px-12 py-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black rounded-xl text-2xl shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] transform transition-all hover:scale-110 active:scale-95 border-b-4 border-teal-800 active:border-b-0 active:translate-y-1"
            >
              START GAME
            </button>
          </div>
        )}

        {/* Level Complete Overlay */}
        {gameState === GameState.LEVEL_COMPLETE && (
          <div className="absolute inset-0 bg-indigo-900/80 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in zoom-in-90 duration-300">
             <div className="relative mb-8">
               <h2 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-500 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)] tracking-tighter italic">
                 SECTOR<br/>SECURED
               </h2>
               <div className="h-2 w-full bg-cyan-500 mt-2 rounded-full animate-pulse"></div>
             </div>

             <div className="bg-black/40 p-8 rounded-2xl border border-white/10 backdrop-blur-xl mb-10 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                   <span className="text-slate-400 uppercase text-xs tracking-widest">Time Bonus</span>
                   <span className="text-cyan-400 font-mono text-xl">+{stats.timeLeft * 10}</span>
                </div>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                   <span className="text-slate-400 uppercase text-xs tracking-widest">Health Bonus</span>
                   <span className="text-pink-400 font-mono text-xl">+{stats.lives * 100}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-yellow-400 uppercase text-xs tracking-widest font-bold">Reward</span>
                   <span className="text-yellow-400 font-mono text-xl font-bold animate-pulse">+1 LIFE ♥</span>
                </div>
             </div>

             <button 
              onClick={nextLevel}
              className="px-10 py-4 bg-cyan-600 text-white font-black text-xl rounded-full hover:bg-cyan-500 transition-all hover:scale-105 shadow-[0_0_30px_rgba(8,145,178,0.5)] border border-cyan-400"
            >
              NEXT MISSION ➤
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
            <h2 className="text-8xl font-black text-red-600 mb-2 animate-bounce drop-shadow-[0_0_25px_rgba(220,38,38,0.8)] tracking-tighter">GAME OVER</h2>
            <div className="text-center mb-10 p-6 bg-red-900/20 rounded-2xl border border-red-900/50">
                <p className="text-red-300 text-sm uppercase tracking-[0.3em] mb-2">Final Score</p>
                <p className="text-6xl font-mono text-white font-bold">{stats.score}</p>
            </div>
            <button 
              onClick={startGame}
              className="px-10 py-4 bg-white text-red-900 font-black rounded-full hover:bg-gray-200 transition-transform hover:scale-105 shadow-xl"
            >
              RETRY LEVEL
            </button>
          </div>
        )}

        {/* Victory Overlay */}
        {gameState === GameState.VICTORY && (
          <div className="absolute inset-0 bg-yellow-600/90 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in zoom-in duration-500">
             <h2 className="text-8xl font-black text-white mb-2 drop-shadow-lg tracking-tighter">VICTORY!</h2>
             <p className="text-2xl text-yellow-100 font-bold mb-10 drop-shadow-md tracking-wide">ALL LEVELS CLEARED</p>
             <div className="text-center mb-12 bg-black/30 p-8 rounded-2xl border border-white/20 backdrop-blur-xl">
                <p className="text-yellow-300 text-sm uppercase tracking-[0.3em] mb-2">Total Score</p>
                <p className="text-7xl font-mono text-white font-bold">{stats.score}</p>
             </div>
             <button 
              onClick={startGame}
              className="px-12 py-5 bg-black text-white font-black rounded-full hover:bg-gray-900 transition-transform hover:scale-105 shadow-2xl border border-gray-700"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* Pause Overlay */}
        {isPaused && (
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-40 flex items-center justify-center">
              <div className="bg-black/80 px-16 py-10 rounded-2xl border border-white/10">
                 <h2 className="text-6xl font-black text-white tracking-[0.2em] opacity-90 text-center">PAUSED</h2>
                 <p className="text-center text-gray-400 mt-4 text-sm font-mono">PRESS BUTTON TO RESUME</p>
              </div>
           </div>
        )}

      </div>
    </div>
  );
}
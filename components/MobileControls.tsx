import React from 'react';
import { globalGameEngine } from './GameCanvas';

export const MobileControls: React.FC = () => {
  const handleTouch = (key: string, pressed: boolean) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (globalGameEngine) {
        globalGameEngine.setVirtualInput(key, pressed);
    }
  };

  const btnClass = "w-14 h-14 bg-white/10 rounded-full border-2 border-white/30 backdrop-blur-sm active:bg-white/30 flex items-center justify-center select-none touch-none";

  return (
    <div className="absolute bottom-4 left-0 w-full px-4 flex justify-between items-end pointer-events-none z-20 pb-4">
      {/* D-Pad */}
      <div className="relative w-40 h-40 pointer-events-auto opacity-70">
        <div 
            className={`${btnClass} absolute top-0 left-12`}
            onTouchStart={handleTouch('UP', true)} onTouchEnd={handleTouch('UP', false)}
            onMouseDown={handleTouch('UP', true)} onMouseUp={handleTouch('UP', false)}
        >▲</div>
        <div 
            className={`${btnClass} absolute bottom-0 left-12`}
            onTouchStart={handleTouch('DOWN', true)} onTouchEnd={handleTouch('DOWN', false)}
            onMouseDown={handleTouch('DOWN', true)} onMouseUp={handleTouch('DOWN', false)}
        >▼</div>
        <div 
            className={`${btnClass} absolute top-12 left-0`}
            onTouchStart={handleTouch('LEFT', true)} onTouchEnd={handleTouch('LEFT', false)}
            onMouseDown={handleTouch('LEFT', true)} onMouseUp={handleTouch('LEFT', false)}
        >◀</div>
        <div 
            className={`${btnClass} absolute top-12 right-0`}
            onTouchStart={handleTouch('RIGHT', true)} onTouchEnd={handleTouch('RIGHT', false)}
            onMouseDown={handleTouch('RIGHT', true)} onMouseUp={handleTouch('RIGHT', false)}
        >▶</div>
      </div>

      {/* Action Button */}
      <div className="pointer-events-auto opacity-70 mb-4">
         <div 
            className="w-20 h-20 bg-red-500/40 rounded-full border-4 border-red-300/50 flex items-center justify-center active:bg-red-500/60 touch-none"
            onTouchStart={handleTouch('BOMB', true)} onTouchEnd={handleTouch('BOMB', false)}
            onMouseDown={handleTouch('BOMB', true)} onMouseUp={handleTouch('BOMB', false)}
         >
            <span className="text-white font-bold">BOMB</span>
         </div>
      </div>
    </div>
  );
};
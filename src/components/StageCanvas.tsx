import React, { useState, useCallback } from 'react';
import { Toast } from './Toast';
import { StartOverlay } from './StartOverlay';
import { fmt } from '../constants/catalog';

interface ChipItem {
  id: number;
  x: number;
  y: number;
  text: string;
}

interface StageCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showStartOverlay: boolean;
  toastMessage: string | null;
  onStartBuilding: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

export const StageCanvas: React.FC<StageCanvasProps> = ({
  canvasRef,
  containerRef,
  showStartOverlay,
  toastMessage,
  onStartBuilding,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}) => {
  const [chips, setChips] = useState<ChipItem[]>([]);

  const spawnChip = useCallback((x: number, y: number, cents: number) => {
    const id = Date.now() + Math.random();
    const newChip: ChipItem = {
      id,
      x,
      y: y - 20,
      text: '+' + fmt(cents)
    };
    setChips(prev => [...prev, newChip]);
  }, []);

  const handleChipAnimationEnd = useCallback((id: number) => {
    setChips(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <div id="stagewrap" ref={containerRef}>
      <canvas
        id="cv"
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={e => e.preventDefault()}
      />

      <div id="chips">
        {chips.map(chip => (
          <div
            key={chip.id}
            className="chip"
            style={{ left: `${chip.x}px`, top: `${chip.y}px` }}
            onAnimationEnd={() => handleChipAnimationEnd(chip.id)}
          >
            {chip.text}
          </div>
        ))}
      </div>

      <Toast message={toastMessage} />

      <StartOverlay visible={showStartOverlay} onStart={onStartBuilding} />
    </div>
  );
};

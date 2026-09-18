import React, { useCallback, useState } from 'react';
import { usePizza } from './context/PizzaContext';
import { usePizzaEngine } from './hooks/usePizzaEngine';
import { Header } from './components/Header';
import { StepsNav } from './components/StepsNav';
import { StageCanvas } from './components/StageCanvas';
import { BottomBar } from './components/BottomBar';
import { OrderModal } from './components/OrderModal';
import { TrayBase } from './components/trays/TrayBase';
import { TraySauce } from './components/trays/TraySauce';
import { TrayCheese } from './components/trays/TrayCheese';
import { TrayToppings } from './components/trays/TrayToppings';
import { TrayBake } from './components/trays/TrayBake';
import { TrayReceipt } from './components/trays/TrayReceipt';
import { ToppingId } from './types/pizza';
import { getAudioContext, SND, vib } from './services/audio';
import { StartOverlay } from './components/StartOverlay';
import { CanvasGameOverlay } from './components/CanvasGameOverlay';
import { CATALOG, SAUCE_NEED, fmt } from './constants/catalog';

export const App: React.FC = () => {
  const {
    state,
    setStage,
    toastMessage,
    showToast,
    showOrderModal,
    setShowOrderModal,
    sceneMirror,
    commitTopping,
    canPlace,
    setPulled,
    setBakeQ,
    blueprint,
    resetState,
    addOneTopping
  } = usePizza();

  const [chips, setChips] = useState<{ id: number; x: number; y: number; text: string }[]>([]);

  const spawnChip = useCallback((x: number, y: number, cents: number) => {
    const id = Date.now() + Math.random();
    setChips(prev => [...prev, { id, x, y: y - 20, text: `+${fmt(cents)}` }]);
  }, []);

  const handleChipAnimationEnd = useCallback((id: number) => {
    setChips(prev => prev.filter(c => c.id !== id));
  }, []);

  // Initialize canvas engine
  const engine = usePizzaEngine({
    state,
    sceneMirror,
    onCommitTopping: commitTopping,
    onCanPlace: canPlace,
    onShowToast: showToast,
    onAdvanceStage: (nextStage) => setStage(nextStage),
    onSetPulled: setPulled,
    onSetBakeQ: setBakeQ,
    onSpawnChip: spawnChip
  });

  const handleStartBuilding = () => {
    getAudioContext();
    setStage('base');
    showToast('Pick a size & crust, then roll the dough');
  };

  const handleRestart = () => {
    setShowOrderModal(false);
    resetState();
    engine.resetEngine();
  };

  const handleBuildAnother = () => {
    setShowOrderModal(false);
    resetState();
    engine.resetEngine();
    setStage('base');
    showToast('Fresh dough — pick your base');
  };

  // CTA Click handler
  const handleCtaClick = () => {
    getAudioContext();
    const s = state;

    if (s.stage === 'base') {
      if (!engine.isTossing && engine.spread >= 1) {
        engine.startToss();
      }
    } else if (s.stage === 'sauce') {
      const pct = Math.min(100, Math.round((engine.sauceCoverage / SAUCE_NEED) * 100));
      if (engine.sauceDone || engine.sauceCoverage >= SAUCE_NEED || pct >= 100) {
        setStage('cheese');
      }
    } else if (s.stage === 'cheese') {
      const cheeseNeed = s.extraCheese ? 0.72 : 0.58;
      const pct = Math.min(100, Math.round((engine.cheeseCoverage / cheeseNeed) * 100));
      if (engine.cheeseDone || engine.cheeseCoverage >= cheeseNeed || pct >= 100) {
        setStage('top');
      }
    } else if (s.stage === 'top') {
      if (s.pulled) {
        setStage('review');
        showToast('Looks ready — review your build');
      } else {
        engine.goBake();
      }
    } else if (s.stage === 'bake') {
      if (s.pulled) {
        if (engine.reviewReady) {
          setStage('review');
          showToast('Looks ready — review your build');
        }
      } else if (engine.isBaking) {
        engine.pullOut();
      }
    } else if (s.stage === 'review') {
      setShowOrderModal(true);
      SND.win();
      vib([15, 60, 15, 60, 40]);
    }
  };

  // Drag and drop handler from Topping cards
  const handleStartDragTopping = (id: ToppingId, startX: number, startY: number) => {
    getAudioContext();
    if (state.stage !== 'top') return;

    const canvas = engine.canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();

    let isDrag = false;
    engine.engineRef.current.carried = { type: id };
    engine.engineRef.current.carriedPos.x = startX - r.left;
    engine.engineRef.current.carriedPos.y = startY - r.top;

    const setPos = (clientX: number, clientY: number) => {
      const rc = canvas.getBoundingClientRect();
      engine.engineRef.current.carriedPos.x = clientX - rc.left;
      engine.engineRef.current.carriedPos.y = clientY - rc.top;
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        isDrag = true;
      }
      setPos(ev.clientX, ev.clientY);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handlePointerCancel);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      cleanup();
      if (!isDrag) {
        engine.engineRef.current.carried = null;
        const res = addOneTopping(id, (charge, lx, ly) => {
          const eng = engine.engineRef.current;
          const inn = 1 - CATALOG.crusts[state.crustId].rim;
          spawnChip(eng.cx + lx * eng.R * inn, eng.cy + ly * eng.R * inn, charge);
        });
        if (!res.ok) {
          showToast(res.reason || 'Cannot place topping');
          SND.deny();
        } else {
          SND.thud();
          vib(12);
        }
      } else {
        setPos(ev.clientX, ev.clientY);
        engine.dropCarried();
      }
    };

    const handlePointerCancel = () => {
      cleanup();
      engine.engineRef.current.carried = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handlePointerCancel);
  };

  return (
    <div id="app">
      <Header onRestart={handleRestart} />

      <StepsNav
        currentStage={state.stage}
        onSelectStage={(stage) => {
          if (state.stage !== 'start') {
            setStage(stage);
            SND.tick();
          }
        }}
      />

      <div
        id="stagewrap"
        className={state.stage === 'bake' ? 'oven-stage-active' : ''}
        ref={engine.containerRef}
      >
        <canvas
          id="cv"
          ref={engine.canvasRef}
          onPointerDown={engine.handlePointerDown}
          onPointerMove={engine.handlePointerMove}
          onPointerUp={engine.handlePointerUp}
          onPointerCancel={engine.handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        />

        <div id="chips">
          {chips.map((chip) => (
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

        <div id="toast" className={toastMessage ? 'show' : ''} role="status">
          {toastMessage}
        </div>

        <CanvasGameOverlay
          stage={state.stage}
          spread={engine.spread}
          isTossing={engine.isTossing}
          sauceCoverage={engine.sauceCoverage}
          sauceDone={engine.sauceDone}
          cheeseCoverage={engine.cheeseCoverage}
          cheeseDone={engine.cheeseDone}
          isBaking={engine.isBaking}
          liveDoneness={engine.liveDoneness}
          onToss={() => {
            if (state.stage === 'base' && !engine.isTossing && engine.spread >= 1) {
              engine.startToss();
            }
          }}
        />
      </div>

      <BottomBar
        visible={state.stage !== 'start'}
        spread={engine.spread}
        sauceCoverage={engine.sauceCoverage}
        cheeseCoverage={engine.cheeseCoverage}
        sauceDone={engine.sauceDone}
        cheeseDone={engine.cheeseDone}
        isBaking={engine.isBaking}
        isTossing={engine.isTossing}
        reviewReady={engine.reviewReady}
        onCtaClick={handleCtaClick}
      />

      <div id="tray">
        {state.stage === 'base' && <TrayBase spread={engine.spread} />}
        {state.stage === 'sauce' && <TraySauce sauceCoverage={engine.sauceCoverage} />}
        {state.stage === 'cheese' && (
          <TrayCheese
            cheeseCoverage={engine.cheeseCoverage}
            onBlanketCheese={engine.blanketCheese}
            onClearCheese={engine.clearCheese}
          />
        )}
        {state.stage === 'top' && (
          <TrayToppings
            onStartDragTopping={handleStartDragTopping}
            onSpawnChip={spawnChip}
          />
        )}
        {state.stage === 'bake' && <TrayBake doneness={engine.liveDoneness} />}
        {state.stage === 'review' && (
          <TrayReceipt
            onEditToppings={() => setStage('top')}
            onEditStage={(stage) => setStage(stage)}
            onSpawnChip={spawnChip}
            sauceCoverage={engine.sauceCoverage}
            cheeseCoverage={engine.cheeseCoverage}
            doneness={engine.liveDoneness}
          />
        )}
      </div>

      <StartOverlay visible={state.stage === 'start'} onStart={handleStartBuilding} />

      <OrderModal
        visible={showOrderModal}
        blueprint={blueprint()}
        onBuildAnother={handleBuildAnother}
        onClose={() => setShowOrderModal(false)}
      />
    </div>
  );
};

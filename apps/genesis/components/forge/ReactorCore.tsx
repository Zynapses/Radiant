'use client';

// REACTOR CORE — The "Forge" button
// Not a simple button. It is a "Reactor Core" at the bottom center.
// Click and Hold to "Charge." White plasma fills on hold.
// On release: shockwave ripple across UI, then download .bin file.

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Download, Loader2 } from 'lucide-react';
import { useForgeStore } from '@/lib/forge-store';

interface ReactorCoreProps {
  onForge: () => void;
}

export function ReactorCore({ onForge }: ReactorCoreProps) {
  const { isForging, forgeProgress, forgeResult, resetForge, nodes } = useForgeStore();
  const [chargeLevel, setChargeLevel] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [shockwave, setShockwave] = useState(false);
  const chargeInterval = useRef<NodeJS.Timeout | null>(null);

  const startCharge = useCallback(() => {
    if (isForging || nodes.length === 0) return;
    setIsCharging(true);
    setChargeLevel(0);

    chargeInterval.current = setInterval(() => {
      setChargeLevel((prev) => {
        if (prev >= 1) {
          if (chargeInterval.current) clearInterval(chargeInterval.current);
          return 1;
        }
        return prev + 0.02;
      });
    }, 30);
  }, [isForging, nodes.length]);

  const releaseCharge = useCallback(() => {
    if (chargeInterval.current) clearInterval(chargeInterval.current);
    setIsCharging(false);

    if (chargeLevel >= 0.8) {
      // Charged enough — FORGE!
      setShockwave(true);
      setTimeout(() => setShockwave(false), 1000);
      onForge();
    }

    setChargeLevel(0);
  }, [chargeLevel, onForge]);

  const handleDownload = useCallback(() => {
    if (forgeResult?.binUrl) {
      const a = document.createElement('a');
      a.href = forgeResult.binUrl;
      a.download = `omega-rom-${Date.now()}.bin`;
      a.click();
      resetForge();
    }
  }, [forgeResult, resetForge]);

  const isEmpty = nodes.length === 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3">
      {/* Shockwave effect */}
      <AnimatePresence>
        {shockwave && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute left-1/2 bottom-16 -translate-x-1/2 rounded-full border-2 border-white/30"
              initial={{ width: 60, height: 60, opacity: 0.8 }}
              animate={{ width: 3000, height: 3000, opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute left-1/2 bottom-16 -translate-x-1/2 rounded-full border border-cyan-400/20"
              initial={{ width: 40, height: 40, opacity: 0.6 }}
              animate={{ width: 2000, height: 2000, opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forge result */}
      <AnimatePresence>
        {forgeResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`px-4 py-2 rounded-lg backdrop-blur-md border text-xs font-mono
              ${forgeResult.success
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
          >
            {forgeResult.success ? (
              <button onClick={handleDownload} className="flex items-center gap-2 hover:text-green-300 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Download .bin ROM
              </button>
            ) : (
              <span>{forgeResult.error || 'Forge failed'}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar during forging */}
      {isForging && (
        <div className="w-48 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-white rounded-full"
            animate={{ width: `${forgeProgress * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      )}

      {/* The Reactor Core button */}
      <motion.button
        onMouseDown={startCharge}
        onMouseUp={releaseCharge}
        onMouseLeave={releaseCharge}
        onTouchStart={startCharge}
        onTouchEnd={releaseCharge}
        disabled={isEmpty || isForging}
        className={`
          relative w-20 h-20 rounded-full
          transition-all duration-300
          ${isEmpty ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
          ${isForging ? 'animate-pulse' : ''}
        `}
        whileHover={!isEmpty && !isForging ? { scale: 1.05 } : {}}
        whileTap={!isEmpty && !isForging ? { scale: 0.95 } : {}}
      >
        {/* Outer ring glow */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-300"
          style={{
            boxShadow: isCharging
              ? `0 0 ${20 + chargeLevel * 40}px rgba(255,255,255,${0.1 + chargeLevel * 0.5}), 0 0 ${40 + chargeLevel * 60}px rgba(56,189,248,${chargeLevel * 0.3})`
              : '0 0 15px rgba(56,189,248,0.15)',
          }}
        />

        {/* Background ring */}
        <div className="absolute inset-0 rounded-full bg-[#0a0a0a] border-2 border-white/[0.08]" />

        {/* Charge fill (white plasma rising from bottom) */}
        <div
          className="absolute inset-[3px] rounded-full overflow-hidden"
          style={{ clipPath: `inset(${(1 - chargeLevel) * 100}% 0 0 0)` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-cyan-200/60 to-transparent" />
        </div>

        {/* Inner border */}
        <div className="absolute inset-[2px] rounded-full border border-white/[0.1]" />

        {/* Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isForging ? (
            <Loader2 className="w-7 h-7 text-white/70 animate-spin" />
          ) : (
            <Flame
              className="w-7 h-7 transition-colors duration-300"
              style={{
                color: isCharging
                  ? `rgba(255,255,255,${0.5 + chargeLevel * 0.5})`
                  : 'rgba(56,189,248,0.5)',
              }}
            />
          )}
        </div>
      </motion.button>

      {/* Label */}
      <span className="text-[9px] font-mono uppercase tracking-widest text-white/20">
        {isEmpty ? 'Add shards to forge' : isForging ? 'Forging...' : isCharging ? `Charging ${(chargeLevel * 100).toFixed(0)}%` : 'Hold to Forge'}
      </span>
    </div>
  );
}

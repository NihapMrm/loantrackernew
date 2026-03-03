import { useState, useRef, createContext, useContext, useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Plus, Check, Undo2, RotateCcw, ChevronsLeft, Pin, PinOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getSettings } from '@/hooks/useSettings';

// Context so children can know if the swipe panel is open
const SwipeOpenContext = createContext(false);
export const useSwipeOpen = () => useContext(SwipeOpenContext);

interface SwipeableLoanCardProps {
  children: React.ReactNode;
  onAddPayment: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  onMarkPartial: () => void;
  status: 'OPEN' | 'PARTIAL' | 'PAID';
  peekDelay?: number;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

const ACTION_WIDTH = 210; // 3 buttons × 70px

async function haptic(style: ImpactStyle = ImpactStyle.Light) {
  try {
    if (Capacitor.isNativePlatform() && getSettings().hapticFeedback) {
      await Haptics.impact({ style });
    }
  } catch { /* ignore */ }
}

export function SwipeableLoanCard({
  children,
  onAddPayment,
  onMarkPaid,
  onMarkUnpaid,
  onMarkPartial,
  status,
  peekDelay = 0,
  isPinned = false,
  onTogglePin,
}: SwipeableLoanCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSwiped, setHasSwiped] = useState(false);
  const isDragging = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => { setIsOpen(false); setSwipeOffset(0); };
  const open  = () => { setIsOpen(true);  setSwipeOffset(-ACTION_WIDTH); };

  // Peek animation on mount so users discover the swipe feature
  useEffect(() => {
    const t1 = setTimeout(() => setSwipeOffset(-52), 600 + peekDelay);
    const t2 = setTimeout(() => setSwipeOffset(0), 1100 + peekDelay);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [peekDelay]);

  // Long-press to reveal pin
  const handleLongPressStart = useCallback(() => {
    if (!onTogglePin) return;
    longPressTimer.current = setTimeout(async () => {
      await haptic(ImpactStyle.Medium);
      onTogglePin();
    }, 600);
  }, [onTogglePin]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handlers = useSwipeable({
    onSwiping: (e) => {
      isDragging.current = true;
      handleLongPressEnd();
      if (e.dir === 'Left') {
        isDragging.current = true;
        const base = isOpen ? -ACTION_WIDTH : 0;
        const next = Math.max(base + e.deltaX, -ACTION_WIDTH);
        setSwipeOffset(Math.min(next, 0));
      }
      if (e.dir === 'Right' && isOpen) {
        isDragging.current = true;
        const next = Math.min(-ACTION_WIDTH + e.deltaX, 0);
        setSwipeOffset(Math.max(next, -ACTION_WIDTH));
      }
    },
    onSwiped: async (e) => {
      // Delay reset so the synthetic post-swipe click doesn't immediately close
      setTimeout(() => { isDragging.current = false; }, 20);
      setHasSwiped(true);
      if (e.dir === 'Left' && Math.abs(e.deltaX) > 50) {
        await haptic(ImpactStyle.Light);
        open();
      } else if (e.dir === 'Right' && Math.abs(e.deltaX) > 40) {
        close();
      } else {
        // snap back to current state
        isOpen ? open() : close();
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 10,
  });

  const handleAddPayment = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    haptic();
    onAddPayment();
  };

  const handleMarkPaid = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    haptic(ImpactStyle.Medium);
    onMarkPaid();
  };

  const handleMarkUnpaid = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    haptic();
    onMarkUnpaid();
  };

  const handleMarkPartial = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    haptic();
    onMarkPartial();
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    haptic(ImpactStyle.Medium);
    onTogglePin?.();
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      {...handlers}
      onPointerDown={handleLongPressStart}
      onPointerUp={handleLongPressEnd}
      onPointerLeave={handleLongPressEnd}
      onClick={(e) => {
        if (isOpen && !isDragging.current) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      {/* ── Revealed action panel ── */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_WIDTH }}>
        {status === 'PAID' ? (
          <>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleMarkPartial}
              className="flex flex-col items-center justify-center gap-1 flex-1 bg-amber-500 active:bg-amber-600 text-white text-xs font-semibold select-none"
            >
              <Undo2 className="w-5 h-5" strokeWidth={2.5} />
              <span>Undo Paid</span>
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleMarkUnpaid}
              className="flex flex-col items-center justify-center gap-1 flex-1 bg-red-500 active:bg-red-600 text-white text-xs font-semibold select-none"
            >
              <RotateCcw className="w-5 h-5" strokeWidth={2.5} />
              <span>Unpaid</span>
            </button>
          </>
        ) : (
          <>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleAddPayment}
              className="flex flex-col items-center justify-center gap-1 flex-1 bg-blue-500 active:bg-blue-600 text-white text-xs font-semibold select-none"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
              <span>Payment</span>
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleMarkPaid}
              className="flex flex-col items-center justify-center gap-1 flex-1 bg-emerald-500 active:bg-emerald-600 text-white text-xs font-semibold select-none"
            >
              <Check className="w-5 h-5" strokeWidth={2.5} />
              <span>Mark Paid</span>
            </button>
          </>
        )}
        {/* Pin button — only when onTogglePin is provided */}
        {onTogglePin && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handlePin}
            className="flex flex-col items-center justify-center gap-1 flex-1 bg-amber-400 active:bg-amber-500 text-white text-xs font-semibold select-none"
          >
            {isPinned
              ? <><PinOff className="w-5 h-5" strokeWidth={2.5} /><span>Unpin</span></>
              : <><Pin className="w-5 h-5" strokeWidth={2.5} /><span>Pin</span></>
            }
          </button>
        )}
      </div>

      {/* ── Sliding card surface ── */}
      <motion.div
        animate={{ x: swipeOffset }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        style={{ touchAction: 'pan-y' }}
        className="relative z-10"
      >
        <SwipeOpenContext.Provider value={isOpen}>
          {children}
        </SwipeOpenContext.Provider>
        {/* Swipe hint icon — fades away after first swipe */}
        {!hasSwiped && !isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-2 top-2 pointer-events-none z-20"
          >
            <ChevronsLeft className="w-4 h-4 text-muted-foreground/40" />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

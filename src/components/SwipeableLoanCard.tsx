import { useState, useRef, createContext, useContext } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Plus, Check, Undo2, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

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
}

const ACTION_WIDTH = 140; // total width of revealed action area

export function SwipeableLoanCard({
  children,
  onAddPayment,
  onMarkPaid,
  onMarkUnpaid,
  onMarkPartial,
  status,
}: SwipeableLoanCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const isDragging = useRef(false);

  const close = () => { setIsOpen(false); setSwipeOffset(0); };
  const open  = () => { setIsOpen(true);  setSwipeOffset(-ACTION_WIDTH); };

  const handlers = useSwipeable({
    onSwiping: (e) => {
      isDragging.current = true;
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
    onSwiped: (e) => {
      // Delay reset so the synthetic post-swipe click doesn't immediately close
      setTimeout(() => { isDragging.current = false; }, 20);
      if (e.dir === 'Left' && Math.abs(e.deltaX) > 50) {
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
    onAddPayment();
  };

  const handleMarkPaid = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    onMarkPaid();
  };

  const handleMarkUnpaid = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    onMarkUnpaid();
  };

  const handleMarkPartial = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    onMarkPartial();
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      {...handlers}
      onClick={(e) => {
        if (isOpen && !isDragging.current) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      {/* ── Revealed action panel ── */}
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: status === 'PAID' ? ACTION_WIDTH : ACTION_WIDTH }}
      >
        {status === 'PAID' ? (
          // Paid loan: show Undo Paid + Mark Unpaid
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
              <span>Mark Unpaid</span>
            </button>
          </>
        ) : (
          // Open/Partial loan: show Add Payment + Mark Paid
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
      </motion.div>
    </div>
  );
}

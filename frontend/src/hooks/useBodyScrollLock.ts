import { useEffect, useRef } from 'react';

// Module-level reference count so multiple simultaneous callers
// (mega-menu + mobile drawer) don't fight each other over the lock.
let lockCount = 0;
let savedScrollY = 0;

function applyLock() {
  if (lockCount === 0) {
    // Freeze the page in-place — prevents the layout jump that plain
    // overflow:hidden causes when the scrollbar disappears.
    savedScrollY = window.scrollY;
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.classList.add('overflow-hidden');
  }
  lockCount++;
}

function releaseLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.classList.remove('overflow-hidden');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    // Restore the scroll position the user was at before the lock.
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
  }
}

export function useBodyScrollLock(locked: boolean) {
  const isLocked = useRef(false);

  useEffect(() => {
    // Apply lock when `locked` becomes true (and we don't already hold it)
    if (locked && !isLocked.current) {
      isLocked.current = true;
      applyLock();
    }

    // Cleanup: release whenever the effect re-runs (locked changed) or
    // the component unmounts — but only if we currently hold the lock.
    return () => {
      if (isLocked.current) {
        isLocked.current = false;
        releaseLock();
      }
    };
  }, [locked]);
}

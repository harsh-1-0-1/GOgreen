import { useEffect } from 'react';
export function useBodyScrollLock(locked) {
    useEffect(() => {
        if (locked)
            document.body.classList.add('overflow-hidden');
        else
            document.body.classList.remove('overflow-hidden');
        return () => document.body.classList.remove('overflow-hidden');
    }, [locked]);
}

import { useEffect } from "react";
import { useLocation } from "wouter";

export function GlobalKeyboardControls() {
  const [location] = useLocation();

  useEffect(() => {
    // Only handle F6 on Telegram page
    if (location !== '/') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for F6 key (both with and without modifiers)
      if (event.key === 'F6' || (event.key === '6' && event.shiftKey)) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('F6 pressed globally');
        
        // Dispatch custom event that Telegram component can listen to
        window.dispatchEvent(new CustomEvent('f6-pressed', { 
          bubbles: true, 
          cancelable: true 
        }));
      }
    };

    // Add event listener to document with capture phase for better reliability
    // Also add to window for additional coverage
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    
    // Keep window focused when possible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Window became visible');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location]);

  return null;
}

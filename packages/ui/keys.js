/**
 * Keyboard shortcuts wiring.
 */
let lastKey = '';
let lastKeyTime = 0;

export function registerKeyListeners({
  onNavigateWorkspace,
  onNavigateActivity,
  onFocusSearch,
  onToggleShortcuts,
  onNavigateItem,
  onCopyResume,
}) {
  const handleKeyDown = (e) => {
    // Skip hotkeys when typing in input or textareas
    if (
      document.activeElement && 
      (document.activeElement.tagName === 'INPUT' || 
       document.activeElement.tagName === 'TEXTAREA')
    ) {
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }

    const now = Date.now();
    const isCombo = lastKey === 'g' && (now - lastKeyTime < 1000);

    // Sequence detection: "g" -> "p" or "g" -> "a"
    if (isCombo) {
      if (e.key === 'p') {
        e.preventDefault();
        onNavigateWorkspace();
        lastKey = '';
        return;
      }
      if (e.key === 'a') {
        e.preventDefault();
        onNavigateActivity();
        lastKey = '';
        return;
      }
    }

    lastKey = e.key;
    lastKeyTime = now;

    // Single hotkeys
    if (e.key === '/') {
      e.preventDefault();
      onFocusSearch();
    } else if (e.key === '?') {
      e.preventDefault();
      onToggleShortcuts();
    } else if (e.key === 'j') {
      e.preventDefault();
      onNavigateItem('down');
    } else if (e.key === 'k') {
      e.preventDefault();
      onNavigateItem('up');
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      onCopyResume();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

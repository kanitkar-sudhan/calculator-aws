import { useCallback, useEffect, useReducer } from 'react';
import { type Action, type Op, initialState, reduce } from './calc';

type Key = {
  label: string;
  action: Action;
  /** Extra styling hook: operators and the wide zero key. */
  variant?: 'op' | 'accent' | 'wide';
};

const KEYS: Key[] = [
  { label: 'AC', action: { type: 'clear' }, variant: 'accent' },
  { label: '±', action: { type: 'negate' }, variant: 'accent' },
  { label: '%', action: { type: 'percent' }, variant: 'accent' },
  { label: '÷', action: { type: 'op', value: '/' }, variant: 'op' },

  { label: '7', action: { type: 'digit', value: '7' } },
  { label: '8', action: { type: 'digit', value: '8' } },
  { label: '9', action: { type: 'digit', value: '9' } },
  { label: '×', action: { type: 'op', value: '*' }, variant: 'op' },

  { label: '4', action: { type: 'digit', value: '4' } },
  { label: '5', action: { type: 'digit', value: '5' } },
  { label: '6', action: { type: 'digit', value: '6' } },
  { label: '−', action: { type: 'op', value: '-' }, variant: 'op' },

  { label: '1', action: { type: 'digit', value: '1' } },
  { label: '2', action: { type: 'digit', value: '2' } },
  { label: '3', action: { type: 'digit', value: '3' } },
  { label: '+', action: { type: 'op', value: '+' }, variant: 'op' },

  { label: '0', action: { type: 'digit', value: '0' }, variant: 'wide' },
  { label: '.', action: { type: 'decimal' } },
  { label: '=', action: { type: 'equals' }, variant: 'op' },
];

/** Maps a keyboard event key onto the same actions the buttons dispatch. */
function actionForKey(key: string): Action | null {
  if (key >= '0' && key <= '9') return { type: 'digit', value: key };
  if (key === '.' || key === ',') return { type: 'decimal' };
  if (key === '+' || key === '-' || key === '*' || key === '/') {
    return { type: 'op', value: key as Op };
  }
  if (key === 'x' || key === 'X') return { type: 'op', value: '*' };
  if (key === 'Enter' || key === '=') return { type: 'equals' };
  if (key === 'Escape' || key === 'c' || key === 'C') return { type: 'clear' };
  if (key === 'Backspace') return { type: 'backspace' };
  if (key === '%') return { type: 'percent' };
  if (key === 'n' || key === 'N') return { type: 'negate' };
  return null;
}

export default function Calculator() {
  const [state, dispatch] = useReducer(reduce, initialState);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const action = actionForKey(event.key);
    if (!action) return;
    event.preventDefault();
    dispatch(action);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="calculator">
      <output
        className="display"
        data-error={state.error || undefined}
        data-long={state.display.length > 9 || undefined}
        aria-live="polite"
      >
        {state.display}
      </output>

      <div className="keypad">
        {KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            className="key"
            data-variant={key.variant}
            onClick={() => dispatch(key.action)}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}

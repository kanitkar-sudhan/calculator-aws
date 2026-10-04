export type Op = '+' | '-' | '*' | '/';

export type CalcState = {
  /** What the screen shows. Always a valid display string. */
  display: string;
  /** Left-hand side of a pending operation. */
  accumulator: number | null;
  pendingOp: Op | null;
  /** Next digit replaces the display instead of appending to it. */
  overwrite: boolean;
  /** Latched after an impossible result; only `clear` gets out of it. */
  error: boolean;
};

export type Action =
  | { type: 'digit'; value: string }
  | { type: 'decimal' }
  | { type: 'op'; value: Op }
  | { type: 'equals' }
  | { type: 'clear' }
  | { type: 'negate' }
  | { type: 'percent' }
  | { type: 'backspace' };

/** Digits kept on screen, and the precision used to hide float noise. */
const MAX_DIGITS = 12;

export const initialState: CalcState = {
  display: '0',
  accumulator: null,
  pendingOp: null,
  overwrite: true,
  error: false,
};

const errorState: CalcState = { ...initialState, display: 'Error', error: true };

/**
 * Renders a number for the display, trimming binary-float noise so that
 * 0.1 + 0.2 reads as 0.3 rather than 0.30000000000000004.
 */
export function format(n: number): string {
  if (!Number.isFinite(n)) return 'Error';

  const rounded = Number(n.toPrecision(MAX_DIGITS));
  if (Object.is(rounded, -0)) return '0';

  const magnitude = Math.abs(rounded);
  if (magnitude !== 0 && (magnitude >= 1e12 || magnitude < 1e-9)) {
    return rounded.toExponential(6).replace(/e([+-])(\d)$/, 'e$10$2');
  }
  return String(rounded);
}

function apply(a: number, b: number, op: Op): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return a / b;
  }
}

/** Digits currently entered, ignoring sign and decimal point. */
function digitCount(display: string): number {
  return display.replace(/[-.]/g, '').length;
}

function settle(result: number): CalcState {
  const display = format(result);
  if (display === 'Error') return errorState;
  return { ...initialState, display, overwrite: true };
}

export function reduce(state: CalcState, action: Action): CalcState {
  if (state.error && action.type !== 'clear') return state;

  const current = Number(state.display);

  switch (action.type) {
    case 'digit': {
      if (state.overwrite) {
        return { ...state, display: action.value, overwrite: false };
      }
      if (state.display === '0') {
        return { ...state, display: action.value };
      }
      if (state.display === '-0') {
        return { ...state, display: `-${action.value}` };
      }
      if (digitCount(state.display) >= MAX_DIGITS) return state;
      return { ...state, display: state.display + action.value };
    }

    case 'decimal': {
      if (state.overwrite) return { ...state, display: '0.', overwrite: false };
      if (state.display.includes('.')) return state;
      return { ...state, display: `${state.display}.` };
    }

    case 'op': {
      // Pressing an operator right after another one just swaps it.
      if (state.overwrite && state.pendingOp !== null) {
        return { ...state, pendingOp: action.value };
      }
      if (state.pendingOp !== null && state.accumulator !== null) {
        const result = apply(state.accumulator, current, state.pendingOp);
        const display = format(result);
        if (display === 'Error') return errorState;
        return {
          ...state,
          display,
          accumulator: result,
          pendingOp: action.value,
          overwrite: true,
        };
      }
      return {
        ...state,
        accumulator: current,
        pendingOp: action.value,
        overwrite: true,
      };
    }

    case 'equals': {
      if (state.pendingOp === null || state.accumulator === null) {
        return { ...state, overwrite: true };
      }
      return settle(apply(state.accumulator, current, state.pendingOp));
    }

    case 'clear':
      return initialState;

    case 'negate': {
      if (state.display === '0') return state;
      const display = state.display.startsWith('-')
        ? state.display.slice(1)
        : `-${state.display}`;
      return { ...state, display };
    }

    case 'percent': {
      const display = format(current / 100);
      if (display === 'Error') return errorState;
      return { ...state, display, overwrite: true };
    }

    case 'backspace': {
      if (state.overwrite) return state;
      const trimmed = state.display.slice(0, -1);
      if (trimmed === '' || trimmed === '-') {
        return { ...state, display: '0', overwrite: true };
      }
      return { ...state, display: trimmed };
    }
  }
}

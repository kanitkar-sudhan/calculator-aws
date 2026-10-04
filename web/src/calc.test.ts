import { describe, expect, it } from 'vitest';
import { type Action, type CalcState, initialState, reduce } from './calc';

/** Runs a sequence of actions from the initial state. */
function run(...actions: Action[]): CalcState {
  return actions.reduce(reduce, initialState);
}

/** Shorthand: '12+3=' style key sequences. */
function press(keys: string): string {
  let state = initialState;
  for (const key of keys) {
    if (key >= '0' && key <= '9') state = reduce(state, { type: 'digit', value: key });
    else if (key === '.') state = reduce(state, { type: 'decimal' });
    else if (key === '=') state = reduce(state, { type: 'equals' });
    else if (key === 'c') state = reduce(state, { type: 'clear' });
    else if (key === '%') state = reduce(state, { type: 'percent' });
    else if (key === '~') state = reduce(state, { type: 'negate' });
    else if (key === '<') state = reduce(state, { type: 'backspace' });
    else state = reduce(state, { type: 'op', value: key as never });
  }
  return state.display;
}

describe('entry', () => {
  it('starts at zero', () => {
    expect(initialState.display).toBe('0');
  });

  it('replaces the leading zero rather than appending', () => {
    expect(press('0')).toBe('0');
    expect(press('7')).toBe('7');
    expect(press('42')).toBe('42');
  });

  it('accepts a single decimal point', () => {
    expect(press('3.14')).toBe('3.14');
    expect(press('3..14')).toBe('3.14');
    expect(press('.5')).toBe('0.5');
  });

  it('caps the number of digits entered', () => {
    expect(press('12345678901234567890')).toBe('123456789012');
  });

  it('backspaces the last character and bottoms out at zero', () => {
    expect(press('123<')).toBe('12');
    expect(press('1<')).toBe('0');
    expect(press('5<<<')).toBe('0');
  });
});

describe('arithmetic', () => {
  it('adds, subtracts, multiplies and divides', () => {
    expect(press('2+3=')).toBe('5');
    expect(press('9-4=')).toBe('5');
    expect(press('6*7=')).toBe('42');
    expect(press('8/2=')).toBe('4');
  });

  it('applies the pending operation as the chain is typed', () => {
    expect(press('2+3+')).toBe('5');
    expect(press('2+3+4=')).toBe('9');
    expect(press('2+3*4=')).toBe('20'); // left to right, no precedence
  });

  it('swaps the operator when two are pressed in a row', () => {
    expect(press('6+*2=')).toBe('12');
    expect(press('6+-2=')).toBe('4');
  });

  it('holds the result when equals is pressed with nothing pending', () => {
    expect(press('7=')).toBe('7');
    expect(press('7==')).toBe('7');
  });

  it('starts a fresh entry after equals', () => {
    expect(press('2+3=9')).toBe('9');
  });

  it('hides binary float noise', () => {
    expect(press('0.1+0.2=')).toBe('0.3');
    expect(press('1/3=')).toBe('0.333333333333');
  });
});

describe('sign and percent', () => {
  it('toggles the sign', () => {
    expect(press('5~')).toBe('-5');
    expect(press('5~~')).toBe('5');
    expect(press('~')).toBe('0');
  });

  it('computes with negative entries', () => {
    expect(press('5~+3=')).toBe('-2');
  });

  it('divides by one hundred', () => {
    expect(press('50%')).toBe('0.5');
    expect(press('50%+1=')).toBe('1.5');
  });
});

describe('errors', () => {
  it('reports division by zero', () => {
    expect(press('5/0=')).toBe('Error');
  });

  it('ignores every key but clear while in the error state', () => {
    expect(press('5/0=7')).toBe('Error');
    expect(press('5/0=+2=')).toBe('Error');
    expect(press('5/0=c')).toBe('0');
    expect(press('5/0=c8')).toBe('8');
  });

  it('treats zero divided by zero as an error too', () => {
    expect(press('0/0=')).toBe('Error');
  });

  it('reports overflow as an error', () => {
    const state = run(
      { type: 'digit', value: '9' },
      { type: 'op', value: '*' },
      { type: 'digit', value: '9' },
    );
    const overflowed = { ...state, accumulator: 1e308, display: '1e308' };
    expect(reduce(overflowed, { type: 'equals' }).display).toBe('Error');
  });
});

describe('clear', () => {
  it('resets everything, including a pending operation', () => {
    expect(press('2+3c')).toBe('0');
    expect(press('2+3c5=')).toBe('5');
  });
});

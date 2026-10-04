import Calculator from './Calculator';

export default function App() {
  return (
    <main className="page">
      <h1 className="title">calculator-aws</h1>
      <Calculator />
      <p className="hint">
        Keyboard works too: digits, <kbd>+</kbd> <kbd>−</kbd> <kbd>*</kbd> <kbd>/</kbd>,{' '}
        <kbd>Enter</kbd> to equal, <kbd>Esc</kbd> to clear.
      </p>
    </main>
  );
}

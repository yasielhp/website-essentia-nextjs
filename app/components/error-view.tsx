"use client";

/**
 * The 500 screen, shared by `app/error.tsx` and `app/[locale]/error.tsx`.
 *
 * Deliberately self-contained: it carries its own `<style>` block instead of
 * Tailwind classes and plain elements instead of `<Button>`. When a Server
 * Component throws early enough, Next renders the error boundary before the
 * global stylesheet has been flushed, and the page came out as raw Times New
 * Roman with the letter-split button labels printed twice. Inline CSS ships
 * with the markup, so this looks the same either way.
 */

const CSS = `
.essentia-error {
  position: relative;
  display: flex;
  min-height: calc(100svh - 140px);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 5rem 1.25rem;
  background: #103838;
  text-align: center;
}
.essentia-error__ghost {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display), Georgia, serif;
  font-size: 28vw;
  line-height: 1;
  color: #0c2c2c;
  opacity: 0.4;
  pointer-events: none;
  user-select: none;
}
.essentia-error__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}
.essentia-error__eyebrow {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.essentia-error__rule {
  display: block;
  width: 2rem;
  height: 1px;
  background: #c2baa5;
}
.essentia-error__label {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #c2baa5;
}
.essentia-error__headline {
  margin: 0;
  max-width: 24rem;
  font-family: var(--font-display), Georgia, serif;
  font-size: 2.25rem;
  font-weight: 400;
  line-height: 1.1;
  color: #faf8f5;
  text-wrap: balance;
}
.essentia-error__body {
  margin: 0;
  max-width: 20rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #c2baa5;
  text-wrap: balance;
}
.essentia-error__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}
.essentia-error__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 1.75rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 0.9375rem;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s ease;
}
.essentia-error__button:hover {
  opacity: 0.85;
}
.essentia-error__button--solid {
  background: #faf8f5;
  color: #103838;
}
.essentia-error__button--outline {
  background: transparent;
  border-color: #faf8f5;
  color: #faf8f5;
}
@media (min-width: 768px) {
  .essentia-error__headline {
    max-width: 32rem;
    font-size: 3.75rem;
  }
  .essentia-error__body {
    max-width: 24rem;
  }
}
`;

export function ErrorView({
  isEs,
  reset,
}: {
  isEs: boolean;
  reset: () => void;
}) {
  return (
    <section className="essentia-error">
      <style>{CSS}</style>

      <span aria-hidden className="essentia-error__ghost">
        500
      </span>

      <div className="essentia-error__inner">
        <div className="essentia-error__eyebrow">
          <span className="essentia-error__rule" />
          <p className="essentia-error__label">
            {isEs ? "Algo salió mal" : "Something went wrong"}
          </p>
          <span className="essentia-error__rule" />
        </div>

        <h1 className="essentia-error__headline">
          {isEs ? (
            <>
              Se produjo un error
              <br />
              inesperado.
            </>
          ) : (
            <>
              An unexpected
              <br />
              error occurred.
            </>
          )}
        </h1>

        <p className="essentia-error__body">
          {isEs
            ? "Pedimos disculpas por las molestias. Por favor, inténtalo de nuevo o vuelve al inicio."
            : "We apologize for the inconvenience. Please try again or return to the home page."}
        </p>

        <div className="essentia-error__actions">
          <button
            type="button"
            onClick={reset}
            className="essentia-error__button essentia-error__button--solid"
          >
            {isEs ? "Intentar de nuevo" : "Try again"}
          </button>
          <a
            href={isEs ? "/es" : "/"}
            className="essentia-error__button essentia-error__button--outline"
          >
            {isEs ? "Volver al inicio" : "Return home"}
          </a>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useSyncExternalStore } from "react";
import styles from "./global-error.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// global-error envuelve todo el árbol, incluyendo el root layout,
// por lo que debe incluir sus propios <html> y <body>.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const isEs = useSyncExternalStore(
    () => () => {},
    () => /(?:^|;\s*)NEXT_LOCALE=es(?:;|$)/.test(document.cookie),
    () => false,
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={isEs ? "es" : "en"}>
      <body className={styles.body}>
        <div className={styles.container}>
          <div className={styles.label}>
            <span className={styles.labelLine} />
            <p className={styles.labelText}>
              {isEs ? "Error crítico" : "Critical error"}
            </p>
            <span className={styles.labelLine} />
          </div>

          <h1 className={styles.headline}>
            {isEs ? (
              <>
                Algo salió
                <br />
                mal.
              </>
            ) : (
              <>
                Something went
                <br />
                wrong.
              </>
            )}
          </h1>

          <p className={styles.bodyText}>
            {isEs
              ? "Se ha producido un error crítico. Por favor, recarga la página o inténtalo de nuevo."
              : "A critical error has occurred. Please reload the page or try again."}
          </p>

          <button onClick={reset} className={styles.button}>
            {isEs ? "Intentar de nuevo" : "Try again"}
          </button>
        </div>
      </body>
    </html>
  );
}

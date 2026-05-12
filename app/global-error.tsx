"use client";

import { useEffect } from "react";
import styles from "./global-error.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// global-error envuelve todo el árbol, incluyendo el root layout,
// por lo que debe incluir sus propios <html> y <body>.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={styles.body}>
        <div className={styles.container}>
          {/* Label */}
          <div className={styles.label}>
            <span className={styles.labelLine} />
            <p className={styles.labelText}>Critical error</p>
            <span className={styles.labelLine} />
          </div>

          {/* Headline */}
          <h1 className={styles.headline}>
            Something went
            <br />
            wrong.
          </h1>

          {/* Body */}
          <p className={styles.bodyText}>
            A critical error has occurred. Please reload the page or try again.
          </p>

          {/* CTA */}
          <button onClick={reset} className={styles.button}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

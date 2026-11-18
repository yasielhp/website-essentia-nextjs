import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmDialog } from "./confirm-dialog";

const base = {
  title: "¿Restablecer «Reserva recibida» en Español?",
  body: "Se borra tu versión guardada y vuelve el texto por defecto.",
  yesLabel: "Restablecer",
  workingLabel: "Restableciendo…",
  noLabel: "Cancelar",
  returnTo: "message-reset-button",
  busy: false,
  onCancel: () => {},
  onConfirm: () => {},
};
const html = (over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) =>
  renderToStaticMarkup(<ConfirmDialog {...base} {...over} />);

describe("the confirmation is a modal dialog", () => {
  test("a native dialog that says what it is, named and described by its own title and text", () => {
    const out = html();
    expect(out).toContain("<dialog");
    expect(out).toContain('role="alertdialog"');
    const labelled = /aria-labelledby="([^"]+)"/.exec(out)?.[1];
    const described = /aria-describedby="([^"]+)"/.exec(out)?.[1];
    expect(labelled).toBeTruthy();
    expect(described).toBeTruthy();
    expect(out).toContain(`id="${labelled}"`);
    expect(out).toContain(`id="${described}"`);
    // The title is the one that names the message and the language.
    expect(
      out.slice(
        out.indexOf(`id="${labelled}"`),
        out.indexOf(`id="${labelled}"`) + 200,
      ),
    ).toContain("¿Restablecer «Reserva recibida» en Español?");
  });

  test("centred for real: Tailwind's reset takes the dialog's own margins away, so the auto margin is put back", () => {
    const out = html();
    expect(out).toContain("m-auto");
    expect(out).toMatch(/w-\[calc\(100vw-2rem\)\]/);
  });

  test("Cancel comes first, so it is the safe answer the focus starts on; the destructive one is red", () => {
    const out = html();
    expect(out.indexOf("Cancelar")).toBeLessThan(out.indexOf("Restablecer<"));
    expect(out).toContain("bg-red-500");
    expect(out).toContain("data-autofocus");
  });

  test("a note, when there is one, is in the dialog's description", () => {
    const out = html({ note: "El recordatorio sigue apagado." });
    expect(out).toContain("El recordatorio sigue apagado.");
    expect(html()).not.toContain("El recordatorio sigue apagado.");
  });

  test("while it works: the button says so and both are off, and nothing can close it", () => {
    const out = html({ busy: true });
    expect(out).toContain("Restableciendo…");
    expect((out.match(/disabled=""/g) ?? []).length).toBe(2);
  });

  test("a failure is shown INSIDE the dialog, as an alert, with the button ready to try again", () => {
    const out = html({ error: "No se pudo restablecer." });
    const dialog = out.slice(out.indexOf("<dialog"), out.indexOf("</dialog>"));
    expect(dialog).toContain('role="alert"');
    expect(dialog).toContain("No se pudo restablecer.");
    expect(dialog).not.toContain('disabled=""');
    expect(html()).not.toContain('role="alert"');
  });

  test("it has no link: opening it cannot trip the page's question about unsaved changes", () => {
    expect(html()).not.toContain("<a ");
  });
});

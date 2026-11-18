import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagePageSkeleton } from "./message-page-skeleton";
import EmailLoading from "./[key]/[locale]/loading";
import WhatsAppLoading from "../whatsapp/[key]/[locale]/loading";

describe("the page of a message while it loads", () => {
  const email = renderToStaticMarkup(
    <MessagePageSkeleton
      channel="email"
      title="Editar «Reserva recibida»"
      label="Cargando…"
    />,
  );
  const whatsapp = renderToStaticMarkup(
    <MessagePageSkeleton channel="whatsapp" />,
  );

  test("says it is loading, to a screen reader, and has nothing to press", () => {
    expect(email).toContain('role="status"');
    expect(email).toContain('aria-busy="true"');
    expect(email).toContain('aria-label="Cargando…"');
    expect(email).not.toContain("<button");
    expect(email).not.toContain("<a ");
  });
  test("an email has the editor's two columns: the form and the preview", () => {
    expect(email).toContain("xl:grid-cols-2");
    // The bar of variables: eight round buttons.
    expect(email.match(/size-8 rounded-full/g)).toHaveLength(8);
    // The dark band of the email's logo, in the preview.
    expect(email).toContain("bg-petroleum-700/15");
  });
  test("its title is written when it is known, and a bar stands in for it when not", () => {
    expect(email).toContain("Editar «Reserva recibida»");
    expect(whatsapp).not.toContain("<h1");
    expect(whatsapp).toContain("h-9 w-72");
  });
  test("a WhatsApp notice has its form and the phone's bubble, not an email", () => {
    expect(whatsapp).toContain("xl:grid-cols-[1fr_360px]");
    expect(whatsapp).not.toContain("bg-petroleum-700/15");
  });
  test("each route shows it the moment it is asked for", () => {
    expect(renderToStaticMarkup(<EmailLoading />)).toContain("xl:grid-cols-2");
    expect(renderToStaticMarkup(<WhatsAppLoading />)).toContain(
      "xl:grid-cols-[1fr_360px]",
    );
  });
});

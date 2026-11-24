import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OptionSelect,
  nextEnabledIndex,
  type SelectOption,
} from "./option-select";

const icon = (name: string) => <svg data-icon={name} />;

const render = (
  options: SelectOption<string>[],
  props: Partial<Parameters<typeof OptionSelect<string>>[0]> = {},
) =>
  renderToStaticMarkup(
    <OptionSelect value="a" options={options} onChange={() => {}} {...props} />,
  );

const plain: SelectOption<string>[] = [
  { value: "a", label: "Uno", desc: "Primero" },
  { value: "b", label: "Dos" },
];

describe("what the select looked like before is unchanged", () => {
  test("options with no icon, badge or disabled flag draw no icon slot, no badge and nothing disabled", () => {
    const html = render(plain, { defaultOpen: true });
    expect(html).not.toContain("<svg data-icon");
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain("size-9");
    expect(html).not.toContain("rounded-full");
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-selected="true"');
  });
});

describe("an icon on an option", () => {
  const options: SelectOption<string>[] = [
    { value: "a", label: "Uno", desc: "Primero", icon: icon("mail") },
    { value: "b", label: "Dos", desc: "Segundo", icon: icon("bell") },
  ];

  test("shows on the trigger with the chosen option's name and description", () => {
    const html = render(options);
    expect(html).toContain('data-icon="mail"');
    expect(html).not.toContain('data-icon="bell"');
    expect(html).toContain("Uno");
    expect(html).toContain("Primero");
  });

  test("shows in the list for every option, decorative: the name and description say it", () => {
    const html = render(options, { defaultOpen: true });
    expect(html.match(/data-icon="mail"/g)).toHaveLength(2); // trigger and list
    expect(html).toContain('data-icon="bell"');
    // Every icon sits in an aria-hidden box.
    for (const m of html.matchAll(/<span[^>]*size-9[^>]*>/g)) {
      expect(m[0]).toContain('aria-hidden="true"');
    }
  });

  test("when only some options have one, the others keep an empty slot so the names line up", () => {
    const html = render(
      [
        { value: "a", label: "Uno", icon: icon("plus") },
        { value: "b", label: "Dos" },
      ],
      { defaultOpen: true },
    );
    // Trigger icon + list icon + one spacer for the option without.
    expect(html.match(/size-9/g)?.length).toBe(3);
  });
});

describe("an option that cannot be picked", () => {
  const options: SelectOption<string>[] = [
    { value: "a", label: "Uno" },
    { value: "b", label: "Dos", disabled: true, badge: "Próximamente" },
  ];

  test("is drawn greyed, disabled for the keyboard and the screen reader, with its badge", () => {
    const html = render(options, { defaultOpen: true });
    const second = html.slice(html.lastIndexOf("<button"));
    expect(second).toContain("disabled");
    expect(second).toContain('aria-disabled="true"');
    expect(second).toContain("cursor-not-allowed");
    expect(second).toContain("Próximamente");
    const first = html.slice(
      html.indexOf('role="option"'),
      html.lastIndexOf("<li>"),
    );
    expect(first).not.toContain("aria-disabled");
  });

  test("a badge on an option that can be picked is just a badge", () => {
    const html = render([{ value: "a", label: "Uno", badge: "Sugerida" }], {
      defaultOpen: true,
    });
    expect(html).toContain("Sugerida");
    expect(html).not.toContain("aria-disabled");
  });
});

describe("nextEnabledIndex: the arrows skip what cannot be picked", () => {
  const o = (disabled: boolean): SelectOption<string> => ({
    value: String(Math.random()),
    label: "x",
    disabled,
  });
  const list = [o(false), o(true), o(false), o(true)];

  test("forward and backward, wrapping, over the enabled ones only", () => {
    expect(nextEnabledIndex(list, 0, 1)).toBe(2);
    expect(nextEnabledIndex(list, 2, 1)).toBe(0);
    expect(nextEnabledIndex(list, 0, -1)).toBe(2);
    expect(nextEnabledIndex(list, 2, -1)).toBe(0);
  });

  test("with nothing disabled it is the plain step round the list", () => {
    const all = [o(false), o(false), o(false)];
    expect(nextEnabledIndex(all, 0, 1)).toBe(1);
    expect(nextEnabledIndex(all, 2, 1)).toBe(0);
    expect(nextEnabledIndex(all, 0, -1)).toBe(2);
  });

  test("with nothing enabled, or no list, there is nowhere to go", () => {
    expect(nextEnabledIndex([o(true), o(true)], 0, 1)).toBe(-1);
    expect(nextEnabledIndex([], 0, 1)).toBe(-1);
  });

  test("from nothing (-1) it goes to the first or the last enabled", () => {
    expect(nextEnabledIndex(list, -1, 1)).toBe(0);
    expect(nextEnabledIndex(list, -1, -1)).toBe(2);
  });
});

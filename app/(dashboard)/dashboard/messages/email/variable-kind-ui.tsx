import type { ReactNode } from "react";
import {
  DEFAULT_RENDER_VARIABLE_FUNCTION,
  type RenderVariableFunction,
} from "@maily-to/core/extensions";
import {
  IconCalendar,
  IconClock,
  IconEuro,
  IconHourglass,
  IconLink,
  IconSparkle,
  IconTag,
  IconUser,
} from "@/components/ui/icons";
import { variableKind, type VariableKind } from "@/lib/messages/variable-kinds";

/**
 * How a kind of variable looks wherever it appears on a message's page: one
 * icon and one soft colour per kind, so the chips that insert it, the cards of
 * the blocks that carry it and the body that holds it all read the same. The
 * colour is never the only signal: there is always the icon and the name. The
 * tones are the palette's, pairs with enough contrast between text and fill.
 */
const ICON: Record<VariableKind, ReactNode> = {
  person: <IconUser />,
  service: <IconSparkle />,
  session: <IconTag />,
  date: <IconCalendar />,
  time: <IconClock />,
  duration: <IconHourglass />,
  money: <IconEuro />,
  link: <IconLink />,
};

/** Fill and text of a kind, as whole class names so Tailwind finds them. */
export const KIND_TONE: Record<VariableKind, string> = {
  person: "bg-petroleum-50 text-petroleum-700",
  service: "bg-teal-50 text-teal-700",
  session: "bg-teal-50 text-teal-700",
  date: "bg-blue-50 text-blue-700",
  time: "bg-blue-50 text-blue-700",
  duration: "bg-blue-50 text-blue-700",
  money: "bg-green-100 text-green-800",
  link: "bg-purple-50 text-purple-700",
};

export function KindIcon({ kind }: { kind: VariableKind }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:size-3.5">
      {ICON[kind]}
    </span>
  );
}

/** A variable as a small, quiet tag: its icon and its name. */
export function VariableTag({
  kind,
  children,
}: {
  kind: VariableKind;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_TONE[kind]}`}
    >
      <KindIcon kind={kind} />
      {children}
    </span>
  );
}

/**
 * How a variable already in the body is drawn inside the editor: the same icon
 * and soft colour as its chip, and its name in words, not the raw `first_name`.
 * Only the editor's view; the saved node is the same. Anything that is not a
 * variable of the body (a button's, the bubble menu's) keeps Maily's own look.
 */
export function bodyVariableRenderer(
  label: (name: string) => string,
): RenderVariableFunction {
  const render: RenderVariableFunction = (opts) => {
    if (opts.from !== "content-variable") {
      return DEFAULT_RENDER_VARIABLE_FUNCTION(opts);
    }
    const name = opts.variable.name;
    const kind = variableKind(name);
    return (
      <span
        data-variable={name}
        className={`inline-flex max-w-xs items-center gap-1 rounded-md px-1.5 py-0.5 align-middle text-sm font-medium ${
          kind ? KIND_TONE[kind] : "bg-sand-100 text-petroleum-700"
        }`}
      >
        {kind && <KindIcon kind={kind} />}
        <span className="truncate">{label(name)}</span>
      </span>
    );
  };
  return render;
}

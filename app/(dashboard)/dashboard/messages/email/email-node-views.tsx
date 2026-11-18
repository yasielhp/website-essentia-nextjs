"use client";

import { useEffect, useReducer, type ReactNode } from "react";
import type { AnyExtension, Editor } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconEdit,
  IconEuro,
  IconGrip,
  IconLink,
  IconPin,
  IconReceipt,
  IconTag,
  IconTrash,
} from "@/components/ui/icons";
import {
  BLOCK_INFO,
  blockCards,
  variableKind,
  type BlockIcon,
} from "@/lib/messages/variable-kinds";
import type { FixedBlock, MessageVariable } from "@/lib/messages/catalog";
import {
  EmailDocGuard,
  EmailTitleNode,
  SystemBlockNode,
  canMove,
  moveBlockTransaction,
} from "./email-nodes";
import { VariableTag } from "./variable-kind-ui";

const ICON: Record<BlockIcon, ReactNode> = {
  details: <IconReceipt />,
  location: <IconPin />,
  money: <IconEuro />,
  calendar: <IconCalendar />,
  link: <IconLink />,
  consent: <IconEdit />,
  voucher: <IconTag />,
};

/** Everything the two views say, already in words. */
export type EmailNodesUi = {
  /** The variables the message offers, to name the ones a block fills. */
  variables: readonly MessageVariable[];
  titleLabel: string;
  blockName: (block: FixedBlock) => string;
  blockWhat: (block: FixedBlock) => string;
  variableLabel: (name: string) => string;
  up: (name: string) => string;
  down: (name: string) => string;
  remove: (name: string) => string;
  drag: (name: string) => string;
};

/** Re-draws a view when the document changes: whether a block can still move depends on its neighbours. */
function useDocVersion(editor: Editor) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    editor.on("update", bump);
    return () => {
      editor.off("update", bump);
    };
  }, [editor]);
}

function TitleView({ ui }: { ui: EmailNodesUi }) {
  return (
    <NodeViewWrapper className="border-sand-100 mb-3 border-b pb-3">
      <p
        contentEditable={false}
        className="text-petroleum-400 mb-1 text-[11px] font-medium tracking-wide uppercase select-none"
      >
        {ui.titleLabel}
      </p>
      <NodeViewContent
        as="h1"
        className="font-display text-petroleum-700 min-h-10 text-2xl leading-tight outline-none sm:text-3xl"
      />
    </NodeViewWrapper>
  );
}

const ACTION =
  "text-petroleum-500 hover:text-petroleum-700 hover:bg-sand-100 focus-visible:ring-petroleum-500 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-30 disabled:hover:bg-transparent sm:size-8";

function BlockView({
  node,
  editor,
  getPos,
  selected,
  ui,
}: NodeViewProps & { ui: EmailNodesUi }) {
  useDocVersion(editor);
  const kind = String(node.attrs.kind) as FixedBlock;
  const info = BLOCK_INFO[kind];
  if (!info) return <NodeViewWrapper />;
  const name = ui.blockName(kind);
  const pos = typeof getPos === "function" ? getPos() : undefined;
  const can = (dir: "up" | "down") =>
    typeof pos === "number" && canMove(editor.state.doc, pos, dir);
  const variables = blockCards([kind], ui.variables)[0]!.variables;

  const move = (dir: "up" | "down") => {
    const at = typeof getPos === "function" ? getPos() : undefined;
    if (typeof at !== "number") return;
    const tr = moveBlockTransaction(editor.state, at, dir);
    if (!tr) return;
    editor.view.dispatch(tr.scrollIntoView());
    // The block is drawn again where it landed: the focus goes back to the
    // button that moved it, so a keyboard can keep going.
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-block-kind="${kind}"] [data-action="${dir}"]`,
        )
        ?.focus();
    });
  };
  const remove = () => {
    const at = typeof getPos === "function" ? getPos() : undefined;
    if (typeof at !== "number") return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: at, to: at + node.nodeSize })
      .run();
  };

  return (
    <NodeViewWrapper
      data-block-kind={kind}
      contentEditable={false}
      // The editor's own styles give paragraphs and lists margins and bullets;
      // a card is laid out by its own classes.
      className={`border-sand-500 bg-sand-50 my-2 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-xl border border-dashed px-2 py-3 sm:px-3 [&_li]:m-0 [&_li]:list-none [&_p]:!m-0 [&_ul]:m-0 [&_ul]:list-none [&_ul]:p-0 ${
        selected ? "ring-petroleum-500 ring-2" : ""
      }`}
    >
      <button
        type="button"
        data-drag-handle
        aria-label={ui.drag(name)}
        title={ui.drag(name)}
        className="text-petroleum-400 hover:text-petroleum-700 inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-full active:cursor-grabbing sm:size-8"
      >
        <IconGrip />
      </button>
      <span
        aria-hidden="true"
        className="bg-sand-100 text-petroleum-500 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full"
      >
        {ICON[info.icon]}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-petroleum-700 text-sm font-medium">{name}</p>
        <p className="text-petroleum-500 text-xs">{ui.blockWhat(kind)}</p>
        {variables.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {variables.map((variable) => {
              const vk = variableKind(variable);
              return vk ? (
                <li key={variable}>
                  <VariableTag kind={vk}>
                    {ui.variableLabel(variable)}
                  </VariableTag>
                </li>
              ) : null;
            })}
          </ul>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center justify-end">
        <button
          type="button"
          data-action="up"
          disabled={!can("up")}
          aria-label={ui.up(name)}
          title={ui.up(name)}
          onClick={() => move("up")}
          className={ACTION}
        >
          <IconArrowUp />
        </button>
        <button
          type="button"
          data-action="down"
          disabled={!can("down")}
          aria-label={ui.down(name)}
          title={ui.down(name)}
          onClick={() => move("down")}
          className={ACTION}
        >
          <IconArrowDown />
        </button>
        <button
          type="button"
          data-action="remove"
          aria-label={ui.remove(name)}
          title={ui.remove(name)}
          onClick={remove}
          className={ACTION}
        >
          <IconTrash />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

/**
 * The editor's nodes for the whole email: the title, the blocks the system
 * adds, and the guard that keeps them in order, drawn with `ui`.
 */
export function emailNodeExtensions(ui: EmailNodesUi): AnyExtension[] {
  const Title = (props: NodeViewProps) => <TitleView ui={ui} {...props} />;
  const Block = (props: NodeViewProps) => <BlockView ui={ui} {...props} />;
  return [
    EmailTitleNode.extend({
      addNodeView: () => ReactNodeViewRenderer(Title),
    }),
    SystemBlockNode.extend({
      addNodeView: () =>
        ReactNodeViewRenderer(Block, {
          // The element the editor marks as selected: the overlay it paints is
          // placed against this one, so it is the block's and not the whole page's.
          className: "relative",
          // A press on one of the block's own buttons is the button's: the
          // editor must not take it for a click on the block and select it.
          stopEvent: ({ event }) =>
            Boolean(
              (event.target as HTMLElement | null)?.closest?.("[data-action]"),
            ),
        }),
    }),
    EmailDocGuard,
  ];
}

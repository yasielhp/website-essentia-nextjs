"use client";

import { Editor, type EditorProps } from "@maily-to/core";
import {
  blockquote,
  bulletList,
  button,
  columns,
  divider,
  heading1,
  heading2,
  heading3,
  image,
  orderedList,
  section,
  spacer,
  text,
  type BlockGroupItem,
} from "@maily-to/core/blocks";
import {
  VariableExtension,
  getVariableSuggestions,
  type RenderVariableFunction,
} from "@maily-to/core/extensions";
import { useMemo } from "react";
import "@maily-to/core/style.css";

/**
 * The editor an admin writes a transactional email in, with the slash menu
 * limited to blocks the sending side accepts.
 *
 * Maily's own menu also offers a raw-HTML block; that one is left out by
 * building the group here from the blocks it exports one by one (the menu's
 * default list is not exported, so it cannot be filtered, only replaced). The
 * server is the real defence (it refuses a node the allow-list does not name,
 * and any address that is not https, http or mailto); this keeps the editor
 * from offering what would only be refused. The header and footer templates of
 * the stock menu ("Components") are not exported either, so they are not here.
 *
 * Load it with `next/dynamic` and `ssr: false`: ProseMirror needs a DOM.
 */
const MESSAGE_BLOCKS: BlockGroupItem[] = [
  {
    title: "Blocks",
    commands: [
      text,
      heading1,
      heading2,
      heading3,
      bulletList,
      orderedList,
      blockquote,
      button,
      image,
      divider,
      spacer,
      columns,
      section,
    ],
  },
];

export type MailyEditorProps = Pick<
  EditorProps,
  "contentJson" | "onUpdate" | "onCreate" | "editable"
> & {
  /**
   * How a variable already in the body is drawn (an icon and a colour by kind,
   * say). Only the editor's view changes: what is saved is the same node.
   */
  renderVariable?: RenderVariableFunction;
};

export default function MailyEditor({
  renderVariable,
  ...props
}: MailyEditorProps) {
  // The editor's own variable extension, with the same suggestions and only the
  // drawing replaced (an extension of the same name takes the default's place).
  const extensions = useMemo(
    () =>
      renderVariable
        ? [
            VariableExtension.configure({
              renderVariable,
              suggestion: getVariableSuggestions(),
            }),
          ]
        : undefined,
    [renderVariable],
  );
  return (
    <Editor
      {...props}
      extensions={extensions}
      blocks={MESSAGE_BLOCKS}
      config={{
        hasMenuBar: false,
        spellCheck: true,
        autofocus: false,
        immediatelyRender: false,
        contentClassName: "min-h-64",
      }}
    />
  );
}

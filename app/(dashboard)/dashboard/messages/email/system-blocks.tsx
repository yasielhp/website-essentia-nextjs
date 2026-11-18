"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  IconCalendar,
  IconEdit,
  IconEuro,
  IconLink,
  IconPin,
  IconReceipt,
  IconTag,
} from "@/components/ui/icons";
import type { FixedBlock, MessageVariable } from "@/lib/messages/catalog";
import {
  blockCards,
  variableKind,
  type BlockIcon,
} from "@/lib/messages/variable-kinds";
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

/**
 * What the system adds to the email after the body, drawn where it comes out:
 * one card per block, in the order they go, with a dashed border (nothing here
 * is edited), an icon, the block's name, a line on what it holds and the
 * variables it fills. So the body reads top to bottom as the email does.
 */
export function SystemBlocks({
  fixed,
  variables,
}: {
  fixed: readonly FixedBlock[];
  variables: readonly MessageVariable[];
}) {
  const t = useTranslations("dashboard.messages.email");
  const tEditor = useTranslations("dashboard.messages.email.editor");
  const cards = blockCards(fixed, variables);
  if (cards.length === 0) return null;

  return (
    <section
      aria-labelledby="message-system-blocks"
      className="flex flex-col gap-2"
    >
      <h3
        id="message-system-blocks"
        className="text-petroleum-400 text-xs font-medium"
      >
        {tEditor("systemBlocksTitle")}
      </h3>
      <ol className="flex flex-col gap-2">
        {cards.map((card) => (
          <li
            key={card.block}
            className="border-sand-500 bg-sand-50 flex items-start gap-3 rounded-xl border border-dashed px-4 py-3"
          >
            <span
              aria-hidden="true"
              className="bg-sand-100 text-petroleum-500 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full"
            >
              {ICON[card.icon]}
            </span>
            <div className="min-w-0">
              <p className="text-petroleum-700 text-sm font-medium">
                {t(`fixed.${card.block}`)}
              </p>
              <p className="text-petroleum-500 text-xs">
                {tEditor(`blockWhat.${card.block}`)}
              </p>
              {card.variables.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {card.variables.map((name) => {
                    const kind = variableKind(name);
                    return kind ? (
                      <li key={name}>
                        <VariableTag kind={kind}>
                          {t(`variables.${name}`)}
                        </VariableTag>
                      </li>
                    ) : null;
                  })}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

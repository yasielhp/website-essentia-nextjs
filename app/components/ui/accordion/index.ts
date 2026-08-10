/**
 * The compound `<Accordion>`: root, header, content and group.
 *
 * The four used to share one file. They are assembled here so every caller
 * keeps importing `@components/ui/accordion` and nothing about the API moved.
 */
import { AccordionRoot } from "./root";
import { AccordionHeader } from "./header";
import { AccordionContent } from "./content";
import { AccordionGroup } from "./group";

export type { AccordionGroupHandle } from "./context";

export const Accordion = Object.assign(AccordionRoot, {
  Header: AccordionHeader,
  Content: AccordionContent,
  Group: AccordionGroup,
});

import { IntlMessageFormat } from "intl-messageformat";
import {
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";

/**
 * Test support: the values an ICU message needs, read from the message itself.
 *
 * A test that formats every string of a language file used to carry a list of
 * the argument names it knew, and a new string with a new name failed it for a
 * reason that had nothing to do with the string. Here the arguments are read
 * from the parsed message (also inside the branches of a plural or a select)
 * and each gets a value of the kind it is used as: a number for a plural or a
 * number, a date for a date or a time, one of its own options for a select,
 * text for anything else. Parsing fails on a string that is not ICU, which is
 * what the callers want to hear about.
 */
export function sampleValuesFor(
  message: string,
  locale: string,
): Record<string, string | number | Date | ((chunks: string[]) => string)> {
  const ast = new IntlMessageFormat(message, locale).getAst();
  const values: Record<
    string,
    string | number | Date | ((c: string[]) => string)
  > = {};

  const walk = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      switch (element.type) {
        case TYPE.argument:
          values[element.value] ??= "texto";
          break;
        case TYPE.number:
          values[element.value] ??= 1;
          break;
        case TYPE.date:
        case TYPE.time:
          values[element.value] ??= new Date(0);
          break;
        case TYPE.select:
          values[element.value] ??= Object.keys(element.options)[0] ?? "other";
          for (const option of Object.values(element.options)) {
            walk(option.value);
          }
          break;
        case TYPE.plural:
          values[element.value] ??= 1;
          for (const option of Object.values(element.options)) {
            walk(option.value);
          }
          break;
        case TYPE.tag:
          values[element.value] ??= (chunks: string[]) => chunks.join("");
          walk(element.children);
          break;
        default:
          break;
      }
    }
  };
  walk(ast);
  return values;
}

/** Whether the message parses and formats with the values derived from it. */
export function formatsCleanly(message: string, locale: string): boolean {
  try {
    new IntlMessageFormat(message, locale).format(
      sampleValuesFor(message, locale) as never,
    );
    return true;
  } catch {
    return false;
  }
}

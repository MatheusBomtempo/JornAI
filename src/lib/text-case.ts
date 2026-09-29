/**
 * Case transformations for the art text. Shared between the server render
 * (Sharp/opentype) and the client previews (Fabric.js, template builder) so
 * they always show the same result. Uses the locale-independent Unicode case
 * mappings, which are identical for every supported language.
 */
export type TextTransform = "none" | "sentence" | "capitalize" | "uppercase";

export function applyTextCase(text: string, transform?: TextTransform): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();

    case "capitalize":
      // Every Word With An Initial Capital.
      return text.replace(
        /(^|\s)(\p{L})/gu,
        (_m, sep: string, ch: string) => sep + ch.toUpperCase(),
      );

    case "sentence": {
      // Only the first letter of the sentence, the rest in lower case.
      const lower = text.toLowerCase();
      return lower.replace(
        /^(\s*)(\p{L})/u,
        (_m, sep: string, ch: string) => sep + ch.toUpperCase(),
      );
    }

    default:
      return text;
  }
}

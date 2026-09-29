import { z } from "zod";
import { applyTextCase, type TextTransform } from "../text-case";

/** Character limits defined by the newsroom. */
export const TITLE_MAX = 69;
export const SUBTITLE_MAX = 149;

/** Geometria do slot da foto dentro do template. */
export const photoSlotSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type PhotoSlot = z.infer<typeof photoSlotSchema>;

/**
 * Text slot (title or subtitle). The font is always Poppins — the server
 * render converts the text to vectors with the embedded font file, so the
 * result is identical on any machine.
 */
export const textSlotSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  fontSize: z.number().positive().default(38.2),
  /** Poppins weight available in the render: 400, 600 or 700. */
  weight: z.union([z.literal(400), z.literal(600), z.literal(700)]).default(600),
  color: z.string().default("#ffffff"),
  align: z.enum(["left", "center", "right"]).default("left"),
  lineHeight: z.number().positive().default(1.25),
  /** "none" keeps the text as the AI wrote it (the default for the newspaper's examples). */
  transform: z.enum(["none", "sentence", "capitalize", "uppercase"]).default("none"),
});
export type TextSlot = z.infer<typeof textSlotSchema>;

/** Photo transformation coming from the Fabric.js editor. */
export const photoTransformSchema = z.object({
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  scale: z.number().positive().default(1),
});
export type PhotoTransform = z.infer<typeof photoTransformSchema>;

/**
 * Offset of the title/subtitle relative to the template's default position
 * (which stays intact — the adjustment only applies to this version of the
 * post).
 */
export const textOffsetSchema = z.object({
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
});
export type TextOffset = z.infer<typeof textOffsetSchema>;

/** Applies the case transformation chosen in the template. */
export function applyTransform(
  text: string,
  transform: TextSlot["transform"],
): string {
  return applyTextCase(text, transform as TextTransform);
}

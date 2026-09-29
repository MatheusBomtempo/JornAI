import { z } from "zod";
import { USER_ROLES, CREDIT_TYPES } from "./domain";
import {
  photoSlotSchema,
  textSlotSchema,
  photoTransformSchema,
  textOffsetSchema,
  TITLE_MAX,
  SUBTITLE_MAX,
} from "./render/slots";

const creditTypeIds = CREDIT_TYPES.map((c) => c.id) as [string, ...string[]];

/** Credit/tag: type + @handle. */
export const creditSchema = z.object({
  type: z.enum(creditTypeIds),
  handle: z.string().trim().min(1, "Informe o @ do perfil."),
});

// ── Auth ─────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Logged-in user changes their own password (see /api/auth/change-password). */
export const changePasswordSchema = z.object({
  password: z.string().min(8, "The password must be at least 8 characters long."),
});

// ── Posts ────────────────────────────────────────────────────
/**
 * Unified capture: the reporter sends what they have — text OR link — plus
 * (optionally) a photo. The source type is derived on the server.
 */
export const createPostSchema = z
  .object({
    text: z.string().trim().min(1).optional(),
    url: z.string().url().optional(),
    photo: z.object({ storageUrl: z.string().url() }).optional(),
    /** Attached document (PDF/txt) already converted to text by /api/documents. */
    document: z
      .object({
        name: z.string().min(1),
        text: z.string().trim().min(1),
        pages: z.number().int().positive().optional(),
      })
      .optional(),
    /** Optional credits/tags (@handle + type). */
    credits: z.array(creditSchema).max(8).optional().default([]),
  })
  .refine((d) => !!(d.text || d.url || d.document), {
    message: "Send the text of the story, a link or a document.",
    path: ["text"],
  });

export const saveArtSchema = z.object({
  selectedPhotoId: z.string().uuid(),
  artTemplateId: z.string().uuid(),
  photoTransform: photoTransformSchema,
  title: z.string().max(TITLE_MAX).default(""),
  subtitle: z.string().max(SUBTITLE_MAX).default(""),
  // The title/subtitle position can be adjusted per post, without touching the template.
  titleOffset: textOffsetSchema.optional(),
  subtitleOffset: textOffsetSchema.optional(),
});

export const regenerateSchema = z.object({
  guidance: z.string().optional(),
});

/**
 * Attaches an extra photo to an already-created post — covers the cases where
 * the reporter only decides on the photo after generating the text: found a
 * better image, downloaded one from Google or from a free stock library based
 * on the AI's suggestions. It never replaces the photo already sent; it only
 * adds one more option for the reporter to pick in the art editor.
 */
export const addPhotoSchema = z.object({
  storageUrl: z.string().url(),
});

/** POST /photo-search/import — foto escolhida no picker embutido do Pexels. */
export const importPexelsPhotoSchema = z.object({
  downloadUrl: z.string().url(),
});

/** Same idea as addPhotoSchema, for the video flow. */
export const addVideoSchema = z.object({
  storageUrl: z.string().url(),
  durationMs: z.number().int().positive().optional(),
});

/**
 * Saves the video choice + title (the text that comes in animated on top) and
 * triggers the final render — equivalent to saveArtSchema, but without
 * photo/slots: the video only has the title card, in one of the 3 fixed styles
 * (videoTemplate).
 */
export const saveVideoSchema = z.object({
  selectedVideoId: z.string().uuid(),
  title: z.string().max(TITLE_MAX).default(""),
  /** Vertical adjustment of the block in the editor (px on a 1080x1920 scale).
   *  The render clamps the result inside the Reels safe area anyway. */
  titleOffsetY: z.number().default(0),
  /** Fixed style of the title card — see VIDEO_CARD_STYLES. Default "bold"
   *  (3rd), same as the database default and DEFAULT_VIDEO_TEMPLATE. */
  videoTemplate: z.enum(["classic", "light", "bold"]).default("bold"),
});

export const editVersionSchema = z
  .object({
    title: z.string().max(TITLE_MAX).optional(),
    subtitle: z.string().max(SUBTITLE_MAX).optional(),
    instagramCaption: z.string().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Provide at least one field to edit.",
  });

export const rejectSchema = z.object({
  reason: z.string().min(3, "Informe o motivo da recusa."),
});

// ── Exemplos de estilo ───────────────────────────────────────
export const styleExampleSchema = z
  .object({
    title: z.string().trim().optional(),
    subtitle: z.string().trim().optional(),
    caption: z.string().trim().optional(),
    orderIndex: z.number().int().optional(),
  })
  .refine((d) => !!(d.title || d.subtitle || d.caption), {
    message: "Preencha ao menos um campo do exemplo.",
  });

// ── Templates ────────────────────────────────────────────────
export const artTemplateSchema = z.object({
  name: z.string().min(1),
  canvasWidth: z.number().int().positive().default(1080),
  canvasHeight: z.number().int().positive().default(1080),
  overlayAssetUrl: z.string().url(),
  photoSlot: photoSlotSchema,
  titleSlot: textSlotSchema,
  subtitleSlot: textSlotSchema.optional(),
  isActive: z.boolean().optional(),
});

// ── Users ────────────────────────────────────────────────────
// No password field: it is always generated strong on the server and sent by
// email (never typed by whoever creates the account) — see /api/users POST.
export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(USER_ROLES).default("staff"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// ── Empresa (onboarding) ──────────────────────────────────────
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a color in the #rrggbb format.");

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da empresa."),
  logoUrl: z.string().url().optional(),
  instagramHandle: z.string().trim().max(60).optional(),
});

/** Edit after onboarding (Admin → Company). `null` clears the field. */
export const updateCompanySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da empresa.").optional(),
  logoUrl: z.string().url().nullable().optional(),
  instagramHandle: z.string().trim().max(60).nullable().optional(),
  /** Brand colors — used in the video templates. See VIDEO_CARD_STYLES. */
  brandColorDark: hexColorSchema.nullable().optional(),
  brandColorLight: hexColorSchema.nullable().optional(),
  brandColorAccent: hexColorSchema.nullable().optional(),
});

// ── App settings ─────────────────────────────────────────────
export const updateSettingsSchema = z.object({
  reviewRequired: z.boolean(),
});

/** Word the admin has to type to unlock the reset — checked on the server too. */
export const RESET_CONFIRM_WORD = "APAGAR";

/** POST /admin/reset-data — Admin → Settings → Danger zone. */
export const resetDataSchema = z.object({
  scope: z.enum(["unpublished", "all"]),
  confirm: z.literal(RESET_CONFIRM_WORD, {
    errorMap: () => ({ message: `Type ${RESET_CONFIRM_WORD} to confirm.` }),
  }),
});

// ── API keys ─────────────────────────────────────────────────
export const createApiKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).optional().default([]),
});

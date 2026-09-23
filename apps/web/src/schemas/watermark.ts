import { z } from "zod";

/**
 * Watermark configuration (spec 5).
 *
 * - The global watermark has configurable text, opacity, and angle
 * - Stored in the TemplateVersion.watermarkConfig Json column
 */
export const WatermarkConfigSchema = z.object({
  /** Watermark text. */
  text: z.string().min(1),
  /** Opacity, 0-1. */
  opacity: z.number().min(0).max(1).default(0.2),
  /** Angle in degrees; defaults to -45. */
  angle: z.number().default(-45),
  /** Font size in PDF points. */
  fontSize: z.number().positive().default(48),
  /** Color (#RRGGBB). */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#888888"),
  /** Repeat on every page; when false, drawn on the first page only. */
  repeat: z.boolean().default(true),
});

export type WatermarkConfig = z.infer<typeof WatermarkConfigSchema>;

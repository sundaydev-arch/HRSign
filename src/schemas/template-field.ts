import { z } from "zod";

/**
 * Template field validation rules (spec 3.1).
 *
 * - Field types: TEXT, DATE, SEAL, SIGNATURE (PERFORATION_SEAL reserved)
 * - Rules differ by field type, are stored in a Json column, and must be read
 *   or written through zod
 * - Coordinates use the dedicated CoordinatesSchema (see ./coordinates)
 */

// Text field rules.
export const TextFieldRulesSchema = z.object({
  type: z.literal("text"),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  /** Regular expression. */
  pattern: z.string().optional(),
  /** Automatically shrink the font size to fit the width (spec 5). */
  autoShrink: z.boolean().default(false),
  /** Multi-line. */
  multiline: z.boolean().default(false),
});
export type TextFieldRules = z.infer<typeof TextFieldRulesSchema>;

// Date field rules.
export const DateFieldRulesSchema = z.object({
  type: z.literal("date"),
  /** ISO date string (YYYY-MM-DD). */
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  /** Display format (handled by backend Intl; not hard-coded). */
  format: z.string().optional(),
});
export type DateFieldRules = z.infer<typeof DateFieldRulesSchema>;

// Seal field rules (shared by SEAL / PERFORATION_SEAL).
export const SealFieldRulesSchema = z.object({
  type: z.literal("seal"),
  /** Which seal to use (optional; otherwise the backend picks one by Seal.style + Template.locale). */
  sealId: z.string().optional(),
  /** Seal style override (spec 20.6: decided by the template field, not hard-coded). */
  style: z.enum(["ROUND_CHINESE", "TEXT_INTERNATIONAL", "NONE"]).optional(),
});
export type SealFieldRules = z.infer<typeof SealFieldRulesSchema>;

// Personal signature field rules.
export const SignatureFieldRulesSchema = z.object({
  type: z.literal("signature"),
  /** Allowed signature methods (spec 20.6: Draw / Type / Upload). */
  allowedMethods: z
    .array(z.enum(["draw", "type", "upload"]))
    .nonempty()
    .default(["draw"]),
});
export type SignatureFieldRules = z.infer<typeof SignatureFieldRulesSchema>;

/**
 * Union of field validation rule shapes.
 * discriminatedUnion keeps this type-safe and avoids any.
 */
export const FieldValidationRulesSchema = z.discriminatedUnion("type", [
  TextFieldRulesSchema,
  DateFieldRulesSchema,
  SealFieldRulesSchema,
  SignatureFieldRulesSchema,
]);

export type FieldValidationRules = z.infer<typeof FieldValidationRulesSchema>;

import { z } from "zod";

/**
 * Canonical field coordinates structure (spec 3.1).
 *
 * - Unit: PDF point
 * - Origin: top-left corner of the page (editor convention); the PDF engines
 *   convert to pdf-lib's bottom-left origin at write time
 * - Used by: the TemplateField.coordinates Json column
 * - Conversion between the frontend pdf.js coordinate space (top-left, pixels,
 *   zoomed) and the backend pdf-lib space lives in src/lib/pdf/coordinates.ts
 *   (a later milestone).
 *
 * Reads and writes must go through this schema; never type-assert a Json
 * column directly (spec 13.2).
 */

export const CoordinatesSchema = z.object({
  /** Page number, 1-based. */
  page: z.number().int().positive(),
  /** X coordinate (PDF points, top-left origin). */
  x: z.number(),
  /** Y coordinate (PDF points, top-left origin). */
  y: z.number(),
  /** Width in PDF points. */
  width: z.number().positive(),
  /** Height in PDF points. */
  height: z.number().positive(),
  /** Rotation angle (0-360, clockwise); defaults to 0. */
  rotation: z.number().int().min(0).max(360).default(0),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

/**
 * Cross-page coordinates for a perforation seal (spec 20.6 PERFORATION_SEAL).
 *
 * Perforation seals are not implemented in Phase 1, but the data model and
 * coordinate structure must already be able to express "spans pages".
 */
export const PerforationSealCoordinatesSchema = z
  .object({
    /** First page (inclusive). */
    startPage: z.number().int().positive(),
    /** Last page (inclusive). */
    endPage: z.number().int().positive(),
    /** Relative position on each page (PDF points, top-left origin). */
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().int().min(0).max(360).default(0),
  })
  .refine((d) => d.endPage >= d.startPage, {
    message: "endPage must be greater than or equal to startPage",
    path: ["endPage"],
  });

export type PerforationSealCoordinates = z.infer<
  typeof PerforationSealCoordinatesSchema
>;

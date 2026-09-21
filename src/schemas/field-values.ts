import { z } from "zod";

/**
 * Document field values (spec 3.1).
 *
 * - Document.fieldValues stores the form fill data
 * - Shape: { "employeeName": "张三", "monthlySalary": 12000, "hireDate": "2026-09-21" }
 * - Keys map to TemplateField.id or custom business keys
 */
export const FieldValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export type FieldValues = z.infer<typeof FieldValuesSchema>;

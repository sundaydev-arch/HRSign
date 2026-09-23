import { z } from "zod";

/**
 * Multilingual template field labels (spec 20.2).
 *
 * - TemplateField.labelI18n stores the label keyed by locale
 * - Shape: { "zh-CN": "员工姓名", "en": "Employee Name" }
 * - Falls back to TemplateField.label when the current UI locale is missing
 */
export const LabelI18nSchema = z.record(z.string(), z.string());

export type LabelI18n = z.infer<typeof LabelI18nSchema>;

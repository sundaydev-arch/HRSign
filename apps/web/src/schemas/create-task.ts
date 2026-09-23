import { z } from "zod";

const SignerRoleSchema = z.enum(["APPROVER", "COMPANY_SEAL", "PERSONAL_SIGNATURE"]);

export const CreateSignerInputSchema = z
  .object({
    signRole: SignerRoleSchema,
    userId: z.string().min(1).optional(),
    externalFullName: z.string().optional(),
    externalEmail: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.userId) return;
    const name = (val.externalFullName ?? "").trim();
    const email = (val.externalEmail ?? "").trim();
    if (!name || !email || !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SIGNER_INFO_INCOMPLETE",
      });
    }
  });

export const CreateTaskBodySchema = z.object({
  templateId: z.string().min(1),
  title: z.string().trim().min(1),
  flowType: z.enum(["SEQUENTIAL", "PARALLEL"]),
  expiresAt: z.string().min(1),
  formValues: z.record(z.string(), z.string()).optional().default({}),
  signers: z.array(CreateSignerInputSchema).min(1),
});

export type CreateTaskBodyParsed = z.infer<typeof CreateTaskBodySchema>;

export const BatchCreateTasksSchema = z.object({
  tasks: z.array(CreateTaskBodySchema).min(1).max(100),
});

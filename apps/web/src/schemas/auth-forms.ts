import { z } from "zod";

export const LoginFormSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
});

export type LoginFormValues = z.infer<typeof LoginFormSchema>;

export const ForgotPasswordFormSchema = z.object({
  email: z.string().trim().min(1).email(),
});

export type ForgotPasswordFormValues = z.infer<typeof ForgotPasswordFormSchema>;

export const SetPasswordFormSchema = z
  .object({
    password: z.string().min(8),
    confirm: z.string().min(1),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "PASSWORD_MISMATCH",
  });

export type SetPasswordFormValues = z.infer<typeof SetPasswordFormSchema>;

export const ExternalVerifyCodeSchema = z.object({
  code: z.string().trim().min(1),
});

export type ExternalVerifyCodeValues = z.infer<typeof ExternalVerifyCodeSchema>;

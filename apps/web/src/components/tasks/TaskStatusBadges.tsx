"use client";

import { Badge } from "@/components/ui/badge";
import {
  APPROVAL_STATUS_LABEL_KEYS,
  APPROVAL_STATUS_VARIANTS,
  SIGNING_STATUS_LABEL_KEYS,
  SIGNING_STATUS_VARIANTS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ApprovalStatus, SigningStatus } from "@prisma/client";
import { useTranslations } from "next-intl";

/** Approval + signing chips with machine prefixes so two greens are not ambiguous. */
export function TaskStatusBadges({
  approvalStatus,
  signingStatus,
  className,
}: {
  approvalStatus: ApprovalStatus;
  signingStatus: SigningStatus;
  className?: string;
}) {
  const tl = useTranslations("labels");

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Badge variant={APPROVAL_STATUS_VARIANTS[approvalStatus]}>
        <span className="opacity-70">{tl("statusMachine.approval")}</span>
        <span aria-hidden className="opacity-40">
          ·
        </span>
        {tl(APPROVAL_STATUS_LABEL_KEYS[approvalStatus])}
      </Badge>
      <Badge variant={SIGNING_STATUS_VARIANTS[signingStatus]}>
        <span className="opacity-70">{tl("statusMachine.signing")}</span>
        <span aria-hidden className="opacity-40">
          ·
        </span>
        {tl(SIGNING_STATUS_LABEL_KEYS[signingStatus])}
      </Badge>
    </div>
  );
}

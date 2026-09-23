import { describe, expect, it } from "vitest";
import { assertEnvelopeTransition } from "@/lib/envelopes";
import { ApiError } from "@/lib/api";

describe("envelope state machine", () => {
  it("allows created → sent", () => {
    expect(() => assertEnvelopeTransition("created", "sent")).not.toThrow();
  });

  it("rejects completed → sent", () => {
    expect(() => assertEnvelopeTransition("completed", "sent")).toThrow(ApiError);
  });

  it("allows sent → voided", () => {
    expect(() => assertEnvelopeTransition("sent", "voided")).not.toThrow();
  });
});

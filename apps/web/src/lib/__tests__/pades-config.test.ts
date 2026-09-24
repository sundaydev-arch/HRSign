import { describe, expect, it } from "vitest";
import { isPadesConfigured, padesProviderStatus } from "@/lib/pades-config";

describe("pades-config", () => {
  it("reports stub/partial without PEMs", () => {
    const prevCert = process.env.PADES_CERT_PEM;
    const prevKey = process.env.PADES_KEY_PEM;
    delete process.env.PADES_CERT_PEM;
    delete process.env.PADES_KEY_PEM;
    expect(isPadesConfigured()).toBe(false);
    expect(padesProviderStatus()).toBe("partial");
    if (prevCert) process.env.PADES_CERT_PEM = prevCert;
    if (prevKey) process.env.PADES_KEY_PEM = prevKey;
  });

  it("reports available when both PEMs set", () => {
    process.env.PADES_CERT_PEM = "-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----";
    process.env.PADES_KEY_PEM = "-----BEGIN PRIVATE KEY-----\nY\n-----END PRIVATE KEY-----";
    expect(isPadesConfigured()).toBe(true);
    expect(padesProviderStatus()).toBe("available");
    delete process.env.PADES_CERT_PEM;
    delete process.env.PADES_KEY_PEM;
  });
});

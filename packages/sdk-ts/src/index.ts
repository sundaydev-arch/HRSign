export type HrsignClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
};

/** TypeScript SDK — same `/v1` contract for Next / Python / Go. */
export class HrsignClient {
  private baseUrl: string;
  private apiKey?: string;
  private fetchFn: typeof fetch;

  constructor(opts: HrsignClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchFn = opts.fetch ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }
    if (this.apiKey) headers.set("Authorization", `Bearer ${this.apiKey}`);
    const res = await this.fetchFn(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HRSign ${res.status}: ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  health() {
    return this.request<{ status: string; backend: string; version: string }>("/health");
  }

  // —— Envelopes ——
  listEnvelopes(query?: { status?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (query?.status) q.set("status", query.status);
    if (query?.limit) q.set("limit", String(query.limit));
    const qs = q.toString();
    return this.request<{ envelopes: unknown[] }>(`/envelopes${qs ? `?${qs}` : ""}`);
  }

  getEnvelope(id: string) {
    return this.request(`/envelopes/${id}`);
  }

  createEnvelope(body: unknown) {
    return this.request("/envelopes", { method: "POST", body: JSON.stringify(body) });
  }

  sendEnvelope(id: string) {
    return this.request(`/envelopes/${id}/send`, { method: "POST" });
  }

  voidEnvelope(id: string, reason: string) {
    return this.request(`/envelopes/${id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  signRecipient(envelopeId: string, recipientId: string, body?: unknown) {
    return this.request(`/envelopes/${envelopeId}/recipients/${recipientId}/sign`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  }

  replaceTabs(envelopeId: string, tabs: unknown[]) {
    return this.request(`/envelopes/${envelopeId}/tabs`, {
      method: "PUT",
      body: JSON.stringify({ tabs }),
    });
  }

  certificate(envelopeId: string) {
    return this.request(`/envelopes/${envelopeId}/certificate`);
  }

  evidencePack(envelopeId: string) {
    return this.request(`/envelopes/${envelopeId}/evidence`);
  }

  // —— Accounts ——
  listAccounts() {
    return this.request<{ accounts: unknown[] }>("/accounts");
  }

  createAccount(body: { name: string; slug?: string }) {
    return this.request("/accounts", { method: "POST", body: JSON.stringify(body) });
  }

  getAccount(accountId: string) {
    return this.request(`/accounts/${accountId}`);
  }

  addAccountMember(accountId: string, body: { email: string; role?: string }) {
    return this.request(`/accounts/${accountId}/members`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  listBrands(accountId: string) {
    return this.request<{ brands: unknown[] }>(`/accounts/${accountId}/brands`);
  }

  createBrand(accountId: string, body: { brandName: string; primaryColor?: string }) {
    return this.request(`/accounts/${accountId}/brands`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // —— Platform products ——
  listPowerForms() {
    return this.request<{ powerForms: unknown[] }>("/powerforms");
  }

  createPowerForm(body: { name: string; templateId: string }) {
    return this.request("/powerforms", { method: "POST", body: JSON.stringify(body) });
  }

  createBulkSend(body: {
    templateId: string;
    rows: Array<{ name?: string; email: string }>;
    send?: boolean;
  }) {
    return this.request("/bulk_send_batches", { method: "POST", body: JSON.stringify(body) });
  }

  listBulkSendBatches() {
    return this.request<{ batches: unknown[] }>("/bulk_send_batches");
  }

  createEmbeddedRecipientView(
    envelopeId: string,
    body: { recipientId: string; returnUrl: string; frameAncestors?: string[] },
  ) {
    return this.request<{ url: string; expiresAt: string; token: string }>(
      `/envelopes/${envelopeId}/views/recipient`,
      { method: "POST", body: JSON.stringify(body) },
    );
  }

  listConnectConfigurations() {
    return this.request<{ configurations: unknown[] }>("/connect/configurations");
  }

  createConnectConfiguration(body: {
    name: string;
    url: string;
    events: string[];
    enabled?: boolean;
  }) {
    return this.request("/connect/configurations", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  deleteConnectConfiguration(configurationId: string) {
    return this.request(`/connect/configurations/${configurationId}`, { method: "DELETE" });
  }

  getHostedSignView(envelopeId: string, recipientId: string, token: string) {
    const q = new URLSearchParams({ r: recipientId, t: token });
    return this.request(`/sign/envelope/${envelopeId}?${q}`);
  }

  listClickwraps() {
    return this.request<{ clickwraps: unknown[] }>("/clickwraps");
  }

  createClickwrap(body: unknown) {
    return this.request("/clickwraps", { method: "POST", body: JSON.stringify(body) });
  }

  listRooms() {
    return this.request<{ rooms: unknown[] }>("/rooms");
  }

  createRoom(body: unknown) {
    return this.request("/rooms", { method: "POST", body: JSON.stringify(body) });
  }

  listClmAgreements() {
    return this.request<{ agreements: unknown[] }>("/clm/agreements");
  }

  createClmAgreement(body: unknown) {
    return this.request("/clm/agreements", { method: "POST", body: JSON.stringify(body) });
  }

  listNotaryTransactions() {
    return this.request<{ transactions: unknown[] }>("/notary/transactions");
  }

  createNotaryTransaction(body: unknown) {
    return this.request("/notary/transactions", { method: "POST", body: JSON.stringify(body) });
  }

  // —— Trust / IDV ——
  listTrustProviders() {
    return this.request<{ providers: unknown[] }>("/trust/providers");
  }

  listIdvMethods() {
    return this.request<{ methods: string[]; plugins: unknown[] }>("/identity/methods");
  }
}

export default HrsignClient;

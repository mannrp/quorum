type Fetch = typeof globalThis.fetch;

export type MailpitMessage = Readonly<{
  id: string;
  subject: string;
  from: readonly string[];
  to: readonly string[];
  text: string;
  html: string;
}>;

type MailpitMessageSummary = Omit<MailpitMessage, "text" | "html">;

type MailpitClientConfiguration = Readonly<{
  apiUrl: string;
  fetch?: Fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  pollIntervalMs?: number;
}>;

type WaitForMessageInput = Readonly<{
  recipient: string;
  subject: string;
  timeoutMs: number;
  exercise(message: MailpitMessage): Promise<boolean>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addresses(value: unknown): string[] | undefined {
  const candidates = Array.isArray(value) ? value : [value];
  const parsed = candidates.map((candidate) =>
    isRecord(candidate) && typeof candidate.Address === "string"
      ? candidate.Address
      : undefined,
  );
  return parsed.every((address) => address !== undefined)
    ? (parsed as string[])
    : undefined;
}

function parseSummary(value: unknown): MailpitMessageSummary {
  if (!isRecord(value)) throw new Error("Malformed Mailpit message metadata");

  const from = addresses(value.From);
  const to = addresses(value.To);
  if (
    typeof value.ID !== "string" ||
    typeof value.Subject !== "string" ||
    !from ||
    !to
  ) {
    throw new Error("Malformed Mailpit message metadata");
  }

  return {
    id: value.ID,
    subject: value.Subject,
    from,
    to,
  };
}

function assertLocalMailpitUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A canonical local Mailpit API URL is required");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "mailpit"]);
  if (
    url.protocol !== "http:" ||
    !localHosts.has(url.hostname) ||
    url.username !== "" ||
    url.password !== "" ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("A canonical local Mailpit API URL is required");
  }

  return url.origin;
}

export class MailpitAcceptanceClient {
  readonly #apiUrl: string;
  readonly #fetch: Fetch;
  readonly #now: () => number;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #pollIntervalMs: number;

  constructor(configuration: MailpitClientConfiguration) {
    this.#apiUrl = assertLocalMailpitUrl(configuration.apiUrl);
    this.#fetch = configuration.fetch ?? globalThis.fetch;
    this.#now = configuration.now ?? Date.now;
    this.#sleep =
      configuration.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => {
          setTimeout(resolve, milliseconds);
        }));
    this.#pollIntervalMs = configuration.pollIntervalMs ?? 100;

    if (!Number.isFinite(this.#pollIntervalMs) || this.#pollIntervalMs <= 0) {
      throw new Error("Mailpit poll interval must be positive");
    }
  }

  async #request(path: string): Promise<unknown> {
    const response = await this.#fetch(`${this.#apiUrl}${path}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Mailpit request failed with status ${response.status}`);
    }
    return response.json();
  }

  async listMessages(): Promise<readonly MailpitMessageSummary[]> {
    const value = await this.#request("/api/v1/messages");
    if (!isRecord(value) || !Array.isArray(value.messages)) {
      throw new Error("Malformed Mailpit message list");
    }
    return value.messages.map(parseSummary);
  }

  async #getMessage(summary: MailpitMessageSummary): Promise<MailpitMessage> {
    const value = await this.#request(
      `/api/v1/message/${encodeURIComponent(summary.id)}`,
    );
    if (
      !isRecord(value) ||
      typeof value.Text !== "string" ||
      typeof value.HTML !== "string"
    ) {
      throw new Error("Malformed Mailpit message content");
    }

    const detail = parseSummary(value);
    return { ...detail, text: value.Text, html: value.HTML };
  }

  async waitForAndExercise(input: WaitForMessageInput): Promise<{
    delivered: true;
    exercised: boolean;
  }> {
    if (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0) {
      throw new Error("Mailpit wait timeout must be positive");
    }

    const deadline = this.#now() + input.timeoutMs;
    while (this.#now() < deadline) {
      const summary = (await this.listMessages()).find(
        (message) =>
          message.subject === input.subject &&
          message.to.includes(input.recipient),
      );
      if (summary) {
        try {
          const exercised = await input.exercise(await this.#getMessage(summary));
          return { delivered: true, exercised };
        } catch {
          throw new Error("Mailpit message exercise failed");
        }
      }
      await this.#sleep(
        Math.min(this.#pollIntervalMs, Math.max(1, deadline - this.#now())),
      );
    }

    throw new Error("Expected Mailpit message was not delivered before timeout");
  }
}

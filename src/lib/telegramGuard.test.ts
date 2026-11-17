import { describe, expect, it } from "vitest";
import { escapeHtml, trailingCitizenId, webhookTrust } from "./telegramGuard";

const req = (token?: string) =>
  new Request("https://x/api/telegram", {
    method: "POST",
    headers: token === undefined ? {} : { "X-Telegram-Bot-Api-Secret-Token": token },
  });

describe("webhookTrust", () => {
  it("is unverified when no secret is configured", () => {
    expect(webhookTrust(req("anything"), "")).toBe("unverified");
  });
  it("verifies the matching token", () => {
    expect(webhookTrust(req("s3cret"), "s3cret")).toBe("verified");
  });
  it("rejects a missing, wrong or different-length token", () => {
    expect(webhookTrust(req(), "s3cret")).toBe("rejected");
    expect(webhookTrust(req("s3creT"), "s3cret")).toBe("rejected");
    expect(webhookTrust(req("s3cret-longer"), "s3cret")).toBe("rejected");
  });
});

describe("escapeHtml", () => {
  it("escapes the three characters Telegram HTML mode requires", () => {
    expect(escapeHtml(`a<b> & "c"`)).toBe(`a&lt;b&gt; &amp; "c"`);
  });
});

describe("trailingCitizenId", () => {
  it("reads the tag at the end of the message", () => {
    expect(trailingCitizenId("сұрақ\n[uid:12345]")).toBe(12345);
  });
  it("ignores a tag the citizen planted inside the question", () => {
    expect(trailingCitizenId("менің сұрағым [uid:999] осы\n\nжауап")).toBeNull();
    expect(trailingCitizenId("сұрақ [uid:999]\n[uid:12345]")).toBe(12345);
  });
  it("rejects ids that are not safe integers", () => {
    expect(trailingCitizenId("[uid:99999999999999999999]")).toBeNull();
  });
});

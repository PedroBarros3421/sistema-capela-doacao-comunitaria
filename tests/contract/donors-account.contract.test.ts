import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireDonorAccess: vi.fn(),
  listDonors: vi.fn(),
  getDonorDetail: vi.fn(),
  listDonorMatchReviews: vi.fn(),
  resolveDonorMatchReview: vi.fn(),
  requestDonorAccountAccess: vi.fn(),
  getDonorAccount: vi.fn(),
  updateOwnedSubscription: vi.fn(),
  readDonationReceiptFile: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/auth/access-links", () => ({ requireDonorAccess: mocks.requireDonorAccess }));
vi.mock("@/server/domains/donors/donor-query-service", () => ({
  listDonors: mocks.listDonors,
  getDonorDetail: mocks.getDonorDetail,
}));
vi.mock("@/server/domains/donors/review-service", () => ({
  listDonorMatchReviews: mocks.listDonorMatchReviews,
  resolveDonorMatchReview: mocks.resolveDonorMatchReview,
}));
vi.mock("@/server/domains/donors/account-access-service", () => ({
  requestDonorAccountAccess: mocks.requestDonorAccountAccess,
  getDonorAccount: mocks.getDonorAccount,
}));
vi.mock("@/server/domains/donors/subscription-service", () => ({
  updateOwnedSubscription: mocks.updateOwnedSubscription,
}));
vi.mock("@/server/documents/donation-receipt", () => ({
  readDonationReceiptFile: mocks.readDonationReceiptFile,
}));
vi.mock("@/server/config/env", () => ({
  getServerEnv: () => ({ APP_URL: "http://localhost:3000", DOCUMENT_STORAGE_PATH: "./storage" }),
}));

const base = "http://localhost:3000/api";
const userId = randomUUID();
const donorId = randomUUID();
const reviewId = randomUUID();
const subscriptionId = randomUUID();
const receiptId = randomUUID();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ user: { id: userId, role: "FINANCE" } });
  mocks.requireDonorAccess.mockResolvedValue({ donorId, donor: { id: donorId } });
});

describe("admin donors contract", () => {
  it("lists donors with pagination metadata", async () => {
    mocks.listDonors.mockResolvedValue({ items: [{ id: donorId }], total: 1, page: 1, pageSize: 20 });
    const route = await import("@/app/api/admin/donors/route");
    const response = await route.GET(new Request(`${base}/admin/donors?query=maria`));
    expect(response.status).toBe(200);
    const json = await response.json() as { data: unknown[]; meta: { total: number } };
    expect(json.data).toEqual([{ id: donorId }]);
    expect(json.meta.total).toBe(1);
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Request), "DONOR_READ");
  });

  it("returns donor detail with timeline", async () => {
    mocks.getDonorDetail.mockResolvedValue({ id: donorId, timeline: [], subscriptions: [] });
    const route = await import("@/app/api/admin/donors/[donorId]/route");
    const response = await route.GET(new Request(`${base}/admin/donors/${donorId}`), { params: Promise.resolve({ donorId }) });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ id: donorId, timeline: [], subscriptions: [] });
  });

  it("returns 404 when donor detail is missing", async () => {
    mocks.getDonorDetail.mockResolvedValue(null);
    const route = await import("@/app/api/admin/donors/[donorId]/route");
    const response = await route.GET(new Request(`${base}/admin/donors/${donorId}`), { params: Promise.resolve({ donorId }) });
    expect(response.status).toBe(404);
  });

  it("lists donor match reviews", async () => {
    mocks.listDonorMatchReviews.mockResolvedValue({ items: [{ id: reviewId }], total: 1, page: 1, pageSize: 20 });
    const route = await import("@/app/api/admin/donor-match-reviews/route");
    const response = await route.GET(new Request(`${base}/admin/donor-match-reviews?status=OPEN`));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ id: reviewId }]);
  });

  it("resolves a donor match review", async () => {
    mocks.resolveDonorMatchReview.mockResolvedValue({ id: reviewId, status: "MERGED" });
    const route = await import("@/app/api/admin/donor-match-reviews/[reviewId]/resolution/route");
    const response = await route.POST(
      new Request(`${base}/admin/donor-match-reviews/${reviewId}/resolution`, {
        method: "POST",
        body: JSON.stringify({ decision: "MERGE", survivingDonorId: donorId, note: "Confirmado com o doador" }),
      }),
      { params: Promise.resolve({ reviewId }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Request), "DONOR_WRITE");
    expect(mocks.resolveDonorMatchReview).toHaveBeenCalledWith(userId, reviewId, expect.objectContaining({ decision: "MERGE" }));
  });
});

describe("public donor account contract", () => {
  it("always returns a generic accepted response for access requests", async () => {
    mocks.requestDonorAccountAccess.mockResolvedValue({ message: "ok", deliveryStatus: "SIMULATED" });
    const route = await import("@/app/api/public/account/access-requests/route");
    const response = await route.POST(
      new Request(`${base}/public/account/access-requests`, {
        method: "POST",
        body: JSON.stringify({ identifierType: "CPF_CNPJ", identifier: "12345678900", contact: "doador@example.org" }),
      }),
    );
    expect(response.status).toBe(202);
    expect((await response.json()).data).toEqual({ message: "ok", deliveryStatus: "SIMULATED" });
  });

  it("returns the owner's account projection for a valid donor link", async () => {
    mocks.getDonorAccount.mockResolvedValue({ donor: { name: "Maria" }, donations: [], subscriptions: [] });
    const route = await import("@/app/api/public/account/route");
    const response = await route.GET(
      new Request(`${base}/public/account`, { headers: { authorization: "Bearer valid-token" } }),
    );
    expect(response.status).toBe(200);
    expect(mocks.requireDonorAccess).toHaveBeenCalled();
  });

  it("rejects account access without a valid donor link", async () => {
    mocks.requireDonorAccess.mockRejectedValue(new AuthenticationError());
    const route = await import("@/app/api/public/account/route");
    const response = await route.GET(new Request(`${base}/public/account`));
    expect(response.status).toBe(401);
  });

  it("updates an owned subscription", async () => {
    mocks.updateOwnedSubscription.mockResolvedValue({ id: subscriptionId, status: "PAUSED" });
    const route = await import("@/app/api/public/account/subscriptions/[subscriptionId]/route");
    const response = await route.PATCH(
      new Request(`${base}/public/account/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify({ action: "PAUSE" }),
      }),
      { params: Promise.resolve({ subscriptionId }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.updateOwnedSubscription).toHaveBeenCalledWith(donorId, subscriptionId, expect.objectContaining({ action: "PAUSE" }));
  });

  it("streams an owned receipt as a PDF", async () => {
    mocks.readDonationReceiptFile.mockResolvedValue({ receipt: { id: receiptId, donorId }, bytes: Buffer.from("%PDF-1.4") });
    const route = await import("@/app/api/public/account/receipts/[receiptId]/route");
    const response = await route.GET(
      new Request(`${base}/public/account/receipts/${receiptId}`, { headers: { authorization: "Bearer valid-token" } }),
      { params: Promise.resolve({ receiptId }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
  });

  it("does not serve a receipt owned by another donor", async () => {
    mocks.readDonationReceiptFile.mockResolvedValue({ receipt: { id: receiptId, donorId: randomUUID() }, bytes: Buffer.from("%PDF-1.4") });
    const route = await import("@/app/api/public/account/receipts/[receiptId]/route");
    const response = await route.GET(
      new Request(`${base}/public/account/receipts/${receiptId}`, { headers: { authorization: "Bearer valid-token" } }),
      { params: Promise.resolve({ receiptId }) },
    );
    expect(response.status).toBe(404);
  });
});

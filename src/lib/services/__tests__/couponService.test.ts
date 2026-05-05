import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

// Mock the Supabase client module
const mockSupa = createMockSupabaseClient();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupa.client,
}));

// Import after mocking
import { getCoupons, createManualCoupon, searchCustomers } from "../couponService";

describe("getCoupons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls from('coupons') with select count and ordering", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    const result = await getCoupons();

    expect(mockSupa.client.from).toHaveBeenCalledWith("coupons");
    expect(result).toEqual({ data: [], count: 0 });
  });

  it("returns enriched data with profiles and templates", async () => {
    const coupons = [
      {
        id: 1,
        customer_id: "user-1",
        template_id: 10,
        amount: 500,
        percentage: null,
        used: false,
        created_at: "2026-01-01",
      },
      {
        id: 2,
        customer_id: "user-2",
        template_id: null,
        amount: null,
        percentage: 15,
        used: false,
        created_at: "2026-01-02",
      },
    ];

    const profiles = [
      { id: "user-1", first_name: "Alice", last_name: "Dupont", email: "alice@test.com" },
      { id: "user-2", first_name: "Bob", last_name: "Martin", email: "bob@test.com" },
    ];

    const templates = [{ id: 10, name: "Bonus 5EUR" }];

    mockSupa.setTableResult("coupons", { data: coupons, error: null, count: 2 });
    mockSupa.setTableResult("profiles", { data: profiles, error: null });
    mockSupa.setTableResult("coupon_templates", { data: templates, error: null });

    const result = await getCoupons();

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.profiles).toEqual(profiles[0]);
    expect(result.data[0]?.coupon_templates).toEqual(templates[0]);
    expect(result.data[1]?.profiles).toEqual(profiles[1]);
    expect(result.data[1]?.coupon_templates).toBeNull();
    expect(result.count).toBe(2);
  });

  it("applies isUsed filter", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    await getCoupons({ isUsed: true });

    const calls = mockSupa.getTableCalls("coupons");
    const eqCall = calls.find((c) => c.method === "eq" && c.args[0] === "used");
    expect(eqCall).toBeDefined();
    expect(eqCall!.args[1]).toBe(true);
  });

  it("applies couponType 'amount' filter", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    await getCoupons({ couponType: "amount" });

    const calls = mockSupa.getTableCalls("coupons");
    const notCall = calls.find((c) => c.method === "not" && c.args[0] === "amount");
    const isCall = calls.find((c) => c.method === "is" && c.args[0] === "percentage");
    expect(notCall).toBeDefined();
    expect(isCall).toBeDefined();
    expect(isCall!.args[1]).toBeNull();
  });

  it("applies couponType 'percentage' filter", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    await getCoupons({ couponType: "percentage" });

    const calls = mockSupa.getTableCalls("coupons");
    const notCall = calls.find((c) => c.method === "not" && c.args[0] === "percentage");
    const isCall = calls.find((c) => c.method === "is" && c.args[0] === "amount");
    expect(notCall).toBeDefined();
    expect(isCall).toBeDefined();
    expect(isCall!.args[1]).toBeNull();
  });

  it("applies isExpired=false filter with or clause", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    await getCoupons({ isExpired: false });

    const calls = mockSupa.getTableCalls("coupons");
    const orCall = calls.find((c) => c.method === "or");
    expect(orCall).toBeDefined();
    expect(orCall!.args[0]).toContain("expires_at.is.null");
    expect(orCall!.args[0]).toContain("expires_at.gte.");
  });

  it("applies isExpired=true filter with lt clause", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    await getCoupons({ isExpired: true });

    const calls = mockSupa.getTableCalls("coupons");
    const ltCall = calls.find((c) => c.method === "lt" && c.args[0] === "expires_at");
    expect(ltCall).toBeDefined();
  });

  it("applies distributionType filter", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    await getCoupons({ distributionType: "manual" });

    const calls = mockSupa.getTableCalls("coupons");
    const eqCall = calls.find((c) => c.method === "eq" && c.args[0] === "distribution_type");
    expect(eqCall).toBeDefined();
    expect(eqCall!.args[1]).toBe("manual");
  });

  it("applies customerId filter", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    await getCoupons({ customerId: "user-123" });

    const calls = mockSupa.getTableCalls("coupons");
    const eqCall = calls.find((c) => c.method === "eq" && c.args[0] === "customer_id");
    expect(eqCall).toBeDefined();
    expect(eqCall!.args[1]).toBe("user-123");
  });

  it("handles empty coupons result", async () => {
    mockSupa.setTableResult("coupons", { data: [], error: null, count: 0 });

    const result = await getCoupons();
    expect(result).toEqual({ data: [], count: 0 });
  });

  it("handles null coupons result", async () => {
    mockSupa.setTableResult("coupons", { data: null, error: null, count: 0 });

    const result = await getCoupons();
    expect(result).toEqual({ data: [], count: 0 });
  });
});

describe("createManualCoupon", () => {
  const USER_1 = "11111111-1111-4111-8111-111111111111";
  const ADMIN_1 = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls rpc with correct parameters", async () => {
    mockSupa.setRpcResult({ data: { id: 1 }, error: null });

    await createManualCoupon({
      customerId: USER_1,
      templateId: 5,
      notes: "Geste commercial",
      adminId: ADMIN_1,
    });

    expect(mockSupa.client.rpc).toHaveBeenCalledWith("create_manual_coupon", {
      p_customer_id: USER_1,
      p_template_id: 5,
      p_amount: null,
      p_percentage: null,
      p_expires_at: null,
      p_notes: "Geste commercial",
      p_admin_id: ADMIN_1,
    });
  });

  it("converts expiration date to ISO timestamp at end of day", async () => {
    mockSupa.setRpcResult({ data: { id: 1 }, error: null });

    await createManualCoupon({
      customerId: USER_1,
      percentage: 20,
      expiresAt: "2026-03-15",
    });

    const firstCall = mockSupa.client.rpc.mock.calls[0];
    if (!firstCall) throw new Error("Expected rpc to have been called");
    const rpcArgs = firstCall[1] as Record<string, unknown>;
    expect(rpcArgs.p_expires_at).toBe("2026-03-15T23:59:59.999Z");
  });

  it("sets optional parameters to null when not provided", async () => {
    mockSupa.setRpcResult({ data: { id: 1 }, error: null });

    await createManualCoupon({ customerId: USER_1, templateId: 5 });

    expect(mockSupa.client.rpc).toHaveBeenCalledWith("create_manual_coupon", {
      p_customer_id: USER_1,
      p_template_id: 5,
      p_amount: null,
      p_percentage: null,
      p_expires_at: null,
      p_notes: null,
      p_admin_id: null,
    });
  });

  it("passes amount when provided", async () => {
    mockSupa.setRpcResult({ data: { id: 1 }, error: null });

    await createManualCoupon({
      customerId: USER_1,
      amount: 1000,
    });

    const firstCall = mockSupa.client.rpc.mock.calls[0];
    if (!firstCall) throw new Error("Expected rpc to have been called");
    const rpcArgs = firstCall[1] as Record<string, unknown>;
    expect(rpcArgs.p_amount).toBe(1000);
    expect(rpcArgs.p_percentage).toBeNull();
  });

  it("rejects when both amount and percentage are provided (Zod refine)", async () => {
    mockSupa.setRpcResult({ data: { id: 1 }, error: null });

    await expect(
      createManualCoupon({
        customerId: USER_1,
        amount: 1000,
        percentage: 20,
      })
    ).rejects.toThrow(/templateId, amount, percentage/);
  });

  it("rejects when no amount/percentage/templateId provided (Zod refine)", async () => {
    await expect(
      createManualCoupon({ customerId: USER_1 })
    ).rejects.toThrow(/templateId, amount, percentage/);
  });

  it("throws on RPC error", async () => {
    mockSupa.setRpcResult({ data: null, error: { message: "RPC failed" } } as any);

    await expect(
      createManualCoupon({ customerId: USER_1, templateId: 5 })
    ).rejects.toEqual({ message: "RPC failed" });
  });
});

describe("searchCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls profiles with or filter and limit", async () => {
    const profiles = [
      { id: "user-1", first_name: "Alice", last_name: "Dupont", email: "alice@test.com" },
    ];
    mockSupa.setTableResult("profiles", { data: profiles, error: null });

    const result = await searchCustomers("alice");

    expect(mockSupa.client.from).toHaveBeenCalledWith("profiles");

    const calls = mockSupa.getTableCalls("profiles");
    const orCall = calls.find((c) => c.method === "or");
    expect(orCall).toBeDefined();
    expect(orCall!.args[0]).toContain("alice");

    const limitCall = calls.find((c) => c.method === "limit");
    expect(limitCall).toBeDefined();
    expect(limitCall!.args[0]).toBe(10);

    expect(result).toEqual(profiles);
  });

  it("returns empty array when no results", async () => {
    mockSupa.setTableResult("profiles", { data: null, error: null });

    const result = await searchCustomers("nonexistent");
    expect(result).toEqual([]);
  });
});

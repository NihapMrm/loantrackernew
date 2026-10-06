import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import Dexie from "dexie";
import { roundMoney, deriveStatus } from "@/lib/db";
import { calculateBalance, calculateTotals, Loan } from "@/hooks/useLoans";
import { hashPin, verifyPinHash, isLegacyHash, isValidPin } from "@/lib/pinHash";
import { formatDate } from "@/lib/formatting";

describe("roundMoney (B8)", () => {
  it("removes float drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2500)).toBe(2500);
  });

  it("makes decimal payments settle a loan exactly", () => {
    expect(deriveStatus(0.3, 0.1 + 0.2)).toBe("PAID");
    const loan = {
      id: "l", person_id: "p", account_id: null, amount: 0.3, type: "GIVEN", status: "PAID",
      due_date: null, notes: null, created_at: new Date(), updated_at: new Date(),
      payments: [0.1, 0.2].map((amount, i) => ({ id: String(i), loan_id: "l", amount, payment_date: new Date(), notes: null, created_at: new Date() })),
    } as Loan;
    expect(calculateBalance(loan)).toBe(0);
    expect(calculateTotals([{ ...loan, status: "PARTIAL" }]).toReceive).toBe(0);
  });
});

describe("PIN hashing (B14)", () => {
  it("accepts 4 or 6 digits only", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });

  it("salts every hash and verifies the right PIN only", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a).not.toBe(b);
    expect(a.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(await verifyPinHash("1234", a)).toBe(true);
    expect(await verifyPinHash("4321", a)).toBe(false);
  });

  it("still verifies a v1 unsalted SHA-256 PIN", async () => {
    // sha256("1234")
    const legacy = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
    expect(isLegacyHash(legacy)).toBe(true);
    expect(await verifyPinHash("1234", legacy)).toBe(true);
    expect(await verifyPinHash("0000", legacy)).toBe(false);
  });
});

describe("formatDate (B11)", () => {
  it("shows a dash for a missing date instead of crashing", () => {
    expect(formatDate(new Date(NaN))).toBe("—");
  });
});

describe("Dexie v1 → v2 upgrade", () => {
  it("rounds amounts, normalises payment dates and recomputes statuses", async () => {
    const ts = "2026-02-02T08:57:07.445Z";
    const v1 = new Dexie("LoanTrackerDB");
    v1.version(1).stores({
      people: "id, name",
      accounts: "id, name",
      loans: "id, person_id, account_id, status, type, created_at",
      payments: "id, loan_id, payment_date",
    });
    await v1.table("people").add({ id: "p1", name: "A", phone: null, notes: null, created_at: ts, updated_at: ts });
    await v1.table("loans").bulkAdd([
      { id: "l1", person_id: "p1", account_id: null, amount: 0.30000000000000004, type: "GIVEN", status: "PARTIAL", due_date: "2026-03-20", notes: null, created_at: ts, updated_at: ts },
      { id: "l2", person_id: "p1", account_id: null, amount: 100, type: "GIVEN", status: "PAID", due_date: null, notes: null, created_at: ts, updated_at: ts },
    ]);
    await v1.table("payments").bulkAdd([
      { id: "a", loan_id: "l1", amount: 0.1, payment_date: "2026-02-03T00:00:00.000Z", notes: null, created_at: ts },
      { id: "b", loan_id: "l1", amount: 0.2, payment_date: "2026-02-04", notes: null, created_at: ts },
    ]);
    v1.close();

    // Opening the app's database runs the v2 upgrade
    const { db } = await import("@/lib/db");
    await db.open();
    expect(db.verno).toBe(2);

    const l1 = await db.loans.get("l1");
    expect(l1!.amount).toBe(0.3);
    expect(l1!.status).toBe("PAID");
    expect((await db.loans.get("l2"))!.status).toBe("OPEN");
    expect((await db.payments.get("a"))!.payment_date).toBe("2026-02-03");
    expect(await db.loans.where("due_date").equals("2026-03-20").count()).toBe(1);
    expect(await db.people.count()).toBe(1);
  });
});

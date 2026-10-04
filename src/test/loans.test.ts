import { describe, it, expect } from "vitest";
import { deriveStatus, calculateBalance, calculateTotals, Loan } from "@/hooks/useLoans";

const loan = (over: Partial<Loan>): Loan => ({
  id: "l", person_id: "p", account_id: null, amount: 100, type: "GIVEN", status: "OPEN",
  due_date: null, notes: null, created_at: new Date(), updated_at: new Date(), payments: [], ...over,
});
const pay = (amount: number) => ({ id: String(amount), loan_id: "l", amount, payment_date: new Date(), notes: null, created_at: new Date() });

describe("deriveStatus", () => {
  it("OPEN with no payments", () => expect(deriveStatus(100, 0)).toBe("OPEN"));
  it("PARTIAL when some paid", () => expect(deriveStatus(100, 40)).toBe("PARTIAL"));
  it("PAID when fully paid or overpaid", () => {
    expect(deriveStatus(100, 100)).toBe("PAID");
    expect(deriveStatus(100, 120)).toBe("PAID");
  });
});

describe("balance and totals", () => {
  it("balance = amount - payments", () =>
    expect(calculateBalance(loan({ payments: [pay(30), pay(20)] }))).toBe(50));
  it("totals ignore PAID loans and split by type", () => {
    const t = calculateTotals([
      loan({ type: "GIVEN", payments: [pay(25)] }),
      loan({ type: "TAKEN", amount: 60 }),
      loan({ type: "GIVEN", status: "PAID", payments: [pay(100)] }),
    ]);
    expect(t).toEqual({ toReceive: 75, toPay: 60 });
  });
});

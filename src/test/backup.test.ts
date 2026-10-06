import { describe, it, expect } from "vitest";
import { prepareImport, daysSince } from "@/lib/backup";
import { parseLocalDate } from "@/lib/db";

const ts = "2026-02-02T08:57:07.445Z";
const person = (id: string) => ({ id, name: id, phone: null, notes: null, created_at: ts, updated_at: ts });
const loan = (id: string, over: object = {}) => ({
  id, person_id: "p1", account_id: null, amount: 100, type: "GIVEN", status: "OPEN",
  due_date: null, notes: null, created_at: ts, updated_at: ts, ...over,
});
const payment = (id: string, loan_id: string | undefined, amount: number, payment_date = "2026-02-27") =>
  ({ id, ...(loan_id ? { loan_id } : {}), amount, payment_date, notes: null, created_at: ts });

const backup = (over: object = {}) => ({
  exportedAt: ts, version: 1,
  people: [person("p1")], accounts: [], loans: [loan("l1")], payments: [], ...over,
});

describe("prepareImport", () => {
  it("drops payments without a loan_id instead of failing (the 2026-10-06 backup case)", () => {
    const { tables, report } = prepareImport(backup({
      payments: [payment("a", "l1", 40), payment("orphan1", undefined, 2000), payment("orphan2", undefined, 2000)],
    }));
    expect(tables.payments.map(p => p.id)).toEqual(["a"]);
    expect(report.droppedPayments).toBe(2);
  });

  it("drops payments for loans that aren't in the file", () => {
    const { tables, report } = prepareImport(backup({ payments: [payment("a", "missing", 10)] }));
    expect(tables.payments).toHaveLength(0);
    expect(report.droppedPayments).toBe(1);
  });

  it("drops loans whose person is missing, and their payments with them", () => {
    const { tables, report } = prepareImport(backup({
      loans: [loan("l1"), loan("l2", { person_id: "ghost" })],
      payments: [payment("a", "l2", 10)],
    }));
    expect(tables.loans.map(l => l.id)).toEqual(["l1"]);
    expect(report.droppedLoans).toBe(1);
    expect(report.droppedPayments).toBe(1);
  });

  it("keeps a loan whose account is missing but clears the account", () => {
    const { tables, report } = prepareImport(backup({ loans: [loan("l1", { account_id: "gone" })] }));
    expect(tables.loans[0].account_id).toBeNull();
    expect(report.clearedAccounts).toBe(1);
  });

  it("recomputes status from payments", () => {
    const { tables, report } = prepareImport(backup({
      loans: [loan("l1", { status: "OPEN" }), loan("l2", { status: "PAID" })],
      payments: [payment("a", "l1", 100)],
    }));
    expect(tables.loans.find(l => l.id === "l1")!.status).toBe("PAID");
    expect(tables.loans.find(l => l.id === "l2")!.status).toBe("OPEN");
    expect(report.fixedStatuses).toBe(2);
  });

  it("turns midnight-UTC payment dates into calendar days and leaves others alone", () => {
    const { tables } = prepareImport(backup({
      payments: [payment("a", "l1", 10, "2026-02-03T00:00:00.000Z"), payment("b", "l1", 10, "2026-02-27T08:05:27.921Z")],
    }));
    expect(tables.payments.map(p => p.payment_date)).toEqual(["2026-02-03", "2026-02-27T08:05:27.921Z"]);
  });

  it("strips user_id from the old cloud version", () => {
    const { tables } = prepareImport(backup({ people: [{ ...person("p1"), user_id: "u" }] }));
    expect(tables.people[0]).not.toHaveProperty("user_id");
  });

  it("still rejects a file that isn't a backup", () => {
    expect(() => prepareImport({ hello: "world" })).toThrow(/Invalid backup file/);
    expect(() => prepareImport(backup({ loans: [loan("l1", { amount: -5 })] }))).toThrow(/loans\.0\.amount/);
  });
});

describe("parseLocalDate", () => {
  it("reads yyyy-MM-dd as that calendar day in local time", () => {
    const d = parseLocalDate("2026-03-20");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 20]);
  });
  it("passes full timestamps through", () => {
    expect(parseLocalDate(ts).toISOString()).toBe(ts);
  });
});

describe("daysSince", () => {
  it("counts whole days", () => {
    expect(daysSince("2026-10-01", "2026-10-06")).toBe(5);
    expect(daysSince("2026-10-06", "2026-10-06")).toBe(0);
  });
});

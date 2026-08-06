/**
 * Deposit provider interface — mock now, crypto later without changing UI.
 */
export interface DepositProvider {
  readonly name: string;
  createOrder(input: {
    userId: string;
    amount: number;
  }): Promise<{ orderId: string; status: "pending" | "confirmed" }>;
  confirm?(orderId: string): Promise<void>;
}

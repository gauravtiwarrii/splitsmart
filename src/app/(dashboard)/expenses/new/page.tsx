import { Suspense } from "react";
import NewExpenseFormClient from "./new-expense-client";

export const dynamic = "force-dynamic";

export default function NewExpensePage() {
  return (
    <Suspense fallback={<div className="text-slate-400 p-8 text-center text-xs">Loading expense setup...</div>}>
      <NewExpenseFormClient />
    </Suspense>
  );
}

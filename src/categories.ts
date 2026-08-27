import type { Category, TxType } from "./db";

export type CategoryTree = Category & { children: Category[] };

export function buildTree(cats: Category[], type?: TxType): CategoryTree[] {
  const source = type ? cats.filter((c) => c.type === type) : cats;
  const visible = source.filter((c) => !c.hidden);
  const roots = visible
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return roots.map((root) => ({
    ...root,
    children: visible
      .filter((c) => c.parentId === root.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export function defaultCategories(): Omit<Category, "id">[] {
  let sort = 0;
  const out: Omit<Category, "id">[] = [];
  const parents: { type: TxType; name: string; sortOrder: number }[] = [
    { type: "INCOME", name: "Sales", sortOrder: sort++ },
    { type: "INCOME", name: "Services", sortOrder: sort++ },
    { type: "INCOME", name: "Other Income", sortOrder: sort++ },
    { type: "EXPENSE", name: "Stock / Purchases", sortOrder: sort++ },
    { type: "EXPENSE", name: "Rent", sortOrder: sort++ },
    { type: "EXPENSE", name: "Salary & Wages", sortOrder: sort++ },
    { type: "EXPENSE", name: "Utilities", sortOrder: sort++ },
    { type: "EXPENSE", name: "Transport", sortOrder: sort++ },
    { type: "EXPENSE", name: "Other Expense", sortOrder: sort++ },
  ];
  parents.forEach((p) => out.push({ type: p.type, name: p.name, parentId: null, sortOrder: p.sortOrder, hidden: 0 }));

  const subs: { type: TxType; parentName: string; name: string }[] = [
    { type: "INCOME", parentName: "Sales", name: "Cash Sales" },
    { type: "INCOME", parentName: "Sales", name: "Credit Sales" },
    { type: "EXPENSE", parentName: "Stock / Purchases", name: "Raw Material" },
    { type: "EXPENSE", parentName: "Stock / Purchases", name: "Finished Goods" },
  ];
  subs.forEach((s) => {
    const parentIdx = out.findIndex((c) => c.type === s.type && c.name === s.parentName);
    const parentId = parentIdx >= 0 ? parentIdx + 1 : null; // autoIncrement ids start at 1
    out.push({ type: s.type, name: s.name, parentId, sortOrder: sort++, hidden: 0 });
  });
  return out;
}

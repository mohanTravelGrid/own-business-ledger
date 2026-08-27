import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  type Category,
  type Transaction,
  type TxType,
  db,
  exportData,
  importData,
} from "./db";
import { buildTree, defaultCategories } from "./categories";

type View = "home" | "transactions" | "categories" | "settings";

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function fmtMoney(n: number) {
  return currency.format(n);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function periodFilter(trow: Transaction, from: string, to: string) {
  return trow.date >= from && trow.date <= to;
}

async function ensureSeeded(): Promise<void> {
  const cats = await db.allCategories();
  if (cats.length === 0) {
    for (const c of defaultCategories()) await db.addCategory(c);
  }
}

function App() {
  const [view, setView] = useState<View>("home");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureSeeded().then(() => setReady(true));
  }, []);

  if (!ready) return <div className="app">Loading…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>OBL — Our Business Ledger</h1>
          <div className="sub">Your family business, on your phone</div>
        </div>
      </header>
      {view === "home" && <HomeView onAdd={() => setView("transactions")} />}
      {view === "transactions" && <TransactionsView />}
      {view === "categories" && <CategoriesView />}
      {view === "settings" && <SettingsView />}
      <nav className="tabs">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>Home</button>
        <button className={view === "transactions" ? "active" : ""} onClick={() => setView("transactions")}>Entries</button>
        <button className={view === "categories" ? "active" : ""} onClick={() => setView("categories")}>Categories</button>
        <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>Settings</button>
      </nav>
    </div>
  );
}

function HomeView({ onAdd }: { onAdd: () => void }) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const today = todayStr();
  const todayKey = monthKey(today);

  useEffect(() => {
    db.allTransactions().then(setTxs);
    db.allCategories().then(setCats);
  }, []);

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const todayIncome = txs.filter((t) => t.type === "INCOME" && t.date === today).reduce((s, t) => s + t.amount, 0);
  const todayExpense = txs.filter((t) => t.type === "EXPENSE" && t.date === today).reduce((s, t) => s + t.amount, 0);
  const monthIncome = txs.filter((t) => t.type === "INCOME" && monthKey(t.date) === todayKey).reduce((s, t) => s + t.amount, 0);
  const monthExpense = txs.filter((t) => t.type === "EXPENSE" && monthKey(t.date) === todayKey).reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <div className="card">
        <div className="summary">
          <div className="tile income">
            <div className="label">Today's Income</div>
            <div className="value">{fmtMoney(todayIncome)}</div>
          </div>
          <div className="tile expense">
            <div className="label">Today's Expense</div>
            <div className="value">{fmtMoney(todayExpense)}</div>
          </div>
          <div className="tile income">
            <div className="label">This Month Income</div>
            <div className="value">{fmtMoney(monthIncome)}</div>
          </div>
          <div className="tile expense">
            <div className="label">This Month Expense</div>
            <div className="value">{fmtMoney(monthExpense)}</div>
          </div>
          <div className="tile profit">
            <div className="label">This Month Profit</div>
            <div className="value">{fmtMoney(monthIncome - monthExpense)}</div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="section-title"><h2>Add a record</h2></div>
        <div className="quick-add">
          <button className="qa inc" onClick={onAdd}>＋ Income</button>
          <button className="qa exp" onClick={onAdd}>＋ Expense</button>
        </div>
      </div>
      <div className="card">
        <div className="section-title"><h2>Today's entries</h2></div>
        {todayTxList(txs, today, catMap)}
      </div>
    </>
  );
}

function todayTxList(txs: Transaction[], today: string, catMap: Map<number, Category>) {
  const list = txs.filter((t) => t.date === today).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (list.length === 0) return <div className="empty">Nothing recorded today yet.</div>;
  return (
    <div className="list">
      {list.map((t) => (
        <TxRow key={t.id} trow={t} catMap={catMap} />
      ))}
    </div>
  );
}

function TxRow({ trow, catMap }: { trow: Transaction; catMap?: Map<number, Category> }) {
  return (
    <div className="trow">
      <div>
        <div className="cat">{trow.categoryId ? catMap?.get(trow.categoryId)?.name ?? "Category" : "—"}</div>
        <div className="date">{trow.notes || trow.date}</div>
      </div>
      <div className={`amt ${trow.type === "INCOME" ? "income" : "expense"}`}>{fmtMoney(trow.amount)}</div>
    </div>
  );
}

function TransactionsView() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [period, setPeriod] = useState<"day" | "month">("day");
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<TxType>("EXPENSE");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    db.allTransactions().then(setTxs);
    db.allCategories().then(setCats);
  }, [refresh]);

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const ranged = (() => {
    if (period === "month") {
      const from = `${month}-01`;
      const to = `${month}-31`;
      return txs.filter((t) => periodFilter(t, from, to));
    }
    return txs.filter((t) => t.date === date);
  })();

  const income = ranged.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = ranged.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  const dateLabel = period === "month" ? month : date;

  return (
    <>
      <div className="card">
        <div className="section-title"><h2>Entries · {dateLabel}</h2></div>
        <div className="filters">
          <label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as "day" | "month")}>
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </label>
          {period === "day" ? (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          ) : (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          )}
        </div>
        <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
          <span className="amt income">In {fmtMoney(income)}</span>
          <span className="amt expense">Out {fmtMoney(expense)}</span>
          <span className="amt profit" style={{ color: "var(--green)", fontWeight: 700 }}>Net {fmtMoney(income - expense)}</span>
        </div>
      </div>
      <div className="card">
        <div className="section-title">
          <h2>Records</h2>
          <button className="primary" onClick={() => { setFormType("INCOME"); setFormOpen(true); }}>
            ＋ Add
          </button>
        </div>
        <div className="list" style={{ marginTop: "8px" }}>
          {ranged.length === 0 ? (
            <div className="empty">No entries for this period.</div>
          ) : (
            ranged
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((t) => <TxRow key={t.id} trow={t} catMap={catMap} />)
          )}
        </div>
      </div>
      {formOpen && (
        <AddModal
          type={formType}
          cats={cats}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); setRefresh((r) => r + 1); }}
        />
      )}
    </>
  );
}

function AddModal({ type, cats, onClose, onSaved }: {
  type: TxType;
  cats: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formType, setFormType] = useState<TxType>(type);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const tree = useMemo(() => buildTree(cats, formType), [cats, formType]);
  const selected = tree.find((c) => String(c.id) === categoryId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    await db.addTransaction({
      type: formType,
      categoryId: categoryId ? Number(categoryId) : null,
      subcategoryId: subcategoryId ? Number(subcategoryId) : null,
      amount: amt,
      date,
      notes: notes.trim(),
      mediaIds: [],
    });
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          <h2>Add {formType === "INCOME" ? "Income" : "Expense"}</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={submit}>
          <label className="field">
            Type
            <select value={formType} onChange={(e) => { setFormType(e.target.value as TxType); setCategoryId(""); setSubcategoryId(""); }}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </label>
          <label className="field">
            Category
            <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }}>
              <option value="">Select</option>
              {tree.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {selected && selected.children.length > 0 ? (
            <label className="field">
              Sub-category
              <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
                <option value="">None</option>
                {selected.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="field">
            Amount
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </label>
          <label className="field">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button className="primary" style={{ flex: 1 }} type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoriesView() {
  const [cats, setCats] = useState<Category[]>([]);
  const [filterType, setFilterType] = useState<TxType>("EXPENSE");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    db.allCategories().then(setCats);
  }, [refresh]);

  const tree = useMemo(() => buildTree(cats, filterType), [cats, filterType]);
  const allType = cats.filter((c) => c.type === filterType);

  async function toggle(c: Category) {
    await db.updateCategory({ ...c, hidden: c.hidden ? 0 : 1 });
    setRefresh((r) => r + 1);
  }

  return (
    <>
      <div className="card">
        <div className="section-title"><h2>Categories</h2></div>
        <div className="filters">
          <label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as TxType)}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </label>
        </div>
        <div className="list">
          {tree.map((root) => (
            <div key={root.id}>
              <div className="cat-item">
                <strong>{root.name}</strong>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="ghost" onClick={() => { setEditing(root); setFormOpen(true); }}>Edit</button>
                  <button className="ghost" onClick={() => toggle(root)}>{root.hidden ? "Show" : "Hide"}</button>
                </div>
              </div>
              {root.children.map((child) => (
                <div key={child.id} className="cat-item sub">
                  <span>{child.name}</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="ghost" onClick={() => { setEditing(child); setFormOpen(true); }}>Edit</button>
                    <button className="ghost" onClick={() => toggle(child)}>{child.hidden ? "Show" : "Hide"}</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        {allType.length === 0 ? <div className="empty">No categories.</div> : null}
      </div>
      <div className="card">
        <div className="section-title">
          <h2>Add a category</h2>
        </div>
        <button className="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>+ New</button>
        {error ? <div className="error">{error}</div> : null}
      </div>
      {formOpen && (
        <CategoryModal
          cats={cats}
          defaultType={filterType}
          editing={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); setRefresh((r) => r + 1); }}
          onError={setError}
        />
      )}
    </>
  );
}

function CategoryModal({ cats, defaultType, editing, onClose, onSaved, onError }: {
  cats: Category[];
  defaultType: TxType;
  editing: Category | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [type, setType] = useState<TxType>(editing?.type ?? defaultType);
  const [name, setName] = useState(editing?.name ?? "");
  const [parentId, setParentId] = useState(editing ? String(editing.parentId ?? "") : "");

  const topLevel = cats.filter((c) => c.type === type && c.parentId === null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      onError("Category name is required");
      return;
    }
    if (editing) {
      await db.updateCategory({ ...editing, name: clean });
    } else {
      await db.addCategory({
        type,
        name: clean,
        parentId: parentId ? Number(parentId) : null,
        sortOrder: cats.length,
        hidden: 0,
      });
    }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          <h2>{editing ? "Edit" : "New"} category</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={submit}>
          {!editing ? (
            <>
              <label className="field">
                Type
                <select value={type} onChange={(e) => { setType(e.target.value as TxType); setParentId(""); }}>
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </label>
              <label className="field">
                Parent
                <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">— Main category —</option>
                  {topLevel.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </>
          ) : null}
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="primary" type="submit" style={{ width: "100%" }}>Save</button>
        </form>
      </div>
    </div>
  );
}

function SettingsView() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function backup() {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `obl-backup-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMessage("Backup downloaded.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed");
      setMessage("");
    }
  }

  async function restore(file: File) {
    try {
      const data = JSON.parse(await file.text());
      await importData(data);
      setMessage("Restored successfully.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
      setMessage("");
    }
  }

  return (
    <>
      <div className="card">
        <div className="section-title"><h2>Data & Backup</h2></div>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          All your data stays on this phone. Download a backup regularly and keep it safe —
          it can restore everything to this or another phone.
        </p>
        <div className="settings-actions">
          <button className="primary" onClick={backup}>Download backup</button>
          <label className="field">
            Restore from backup
            <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
        </div>
        {message ? <div className="notice">{message}</div> : null}
        {error ? <div className="error">{error}</div> : null}
      </div>
      <div className="card">
        <h2>About</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          OBL — Our Business Ledger. Version 0.1. A local-only income & expense tracker
          for small family-run businesses. Your data never leaves your phone.
        </p>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

import { useAsync, useDataVersion } from "../api";
import { getDailyExpenseStats, getMonthlyExpenseStats, getTagsStatistics } from "../api/transactions";
import { formatMoney } from "../format";
import { PALETTE } from "./chartTheme";
import LineChart from "./LineChart";
import PieChart from "./PieChart";
import { Page } from "./ui/Page";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TOP_TAGS = 8;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="section-title">{title}</div>
      <div className="surface ion-padding">{children}</div>
    </>
  );
}

function TagBreakdown({ version }: { version: number }) {
  const { data } = useAsync(getTagsStatistics, [version]);
  if (!data) return null;
  if (data.length === 0) return <div className="empty-state">Tag your expenses to see where money goes.</div>;
  const top = data.slice(0, TOP_TAGS);
  const rest = data.slice(TOP_TAGS).reduce((s, t) => s - t.sum, 0);
  const rows = [...top.map((t) => ({ tag: t.tag, amount: -t.sum, count: t.count })),
    ...(rest > 0 ? [{ tag: "Other tags", amount: rest, count: 0 }] : [])];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <PieChart labels={rows.map((r) => r.tag)} data={rows.map((r) => r.amount)} />
      <div className="legend">
        {rows.map((r, i) => (
          <div key={r.tag} className="legend-row">
            <span className="legend-swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="legend-name">{r.tag}</span>
            <span className="row-sub">{total ? Math.round((r.amount / total) * 100) : 0}%</span>
            <span className="amount legend-amount">{formatMoney(r.amount)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Dashboard() {
  const version = useDataVersion();
  const now = new Date();
  const years = [0, 1, 2].map((i) => now.getFullYear() - i);
  const { data: yearly } = useAsync(() => Promise.all(years.map(getMonthlyExpenseStats)), [version]);

  const monthStarts = [0, 1].map((i) => new Date(now.getFullYear(), now.getMonth() - i, 1));
  const { data: daily } = useAsync(
    () => Promise.all(monthStarts.map((d) => getDailyExpenseStats(d.getFullYear(), d.getMonth() + 1))),
    [version]
  );

  return (
    <Page title="Stats">
      <Card title="Spending by tag">
        <TagBreakdown version={version} />
      </Card>
      <Card title="Daily spending">
        <LineChart
          labels={Array.from({ length: 31 }, (_, i) => i + 1)}
          datasets={(daily ?? []).map((days, i) => ({
            label: monthStarts[i].toLocaleDateString(undefined, { month: "long" }),
            data: days.slice(0, i === 0 ? now.getDate() : undefined).map((d) => -d.sum),
          }))}
        />
      </Card>
      <Card title="Monthly spending">
        <LineChart
          labels={MONTHS}
          datasets={(yearly ?? [])
            .map((months, i) => ({
              label: String(years[i]),
              // Don't draw future months of the current year as zero spending.
              data: months.slice(0, i === 0 ? now.getMonth() + 1 : 12).map((m) => -m.sum),
            }))
            .filter((d, i) => i === 0 || d.data.some((v) => v > 0))}
        />
      </Card>
    </Page>
  );
}

export default Dashboard;

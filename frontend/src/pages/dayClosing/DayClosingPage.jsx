import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getDayClosingSummaryApi, listDayClosingsApi, createDayClosingApi } from '../../api/dayClosing.api';
import { HiOutlineCash, HiOutlineLockClosed, HiOutlineDocumentReport } from 'react-icons/hi';

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DayClosingPage() {
  const [date, setDate]           = useState(ymd(new Date()));
  const [summary, setSummary]     = useState(null);
  const [existing, setExisting]   = useState(null);
  const [history, setHistory]     = useState([]);
  const [openingCash, setOpening] = useState('');
  const [countedCash, setCounted] = useState('');
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await getDayClosingSummaryApi(date);
      setSummary(res.data.data.summary);
      setExisting(res.data.data.existing || null);
      if (res.data.data.existing) {
        setOpening(res.data.data.existing.opening_cash);
        setCounted(res.data.data.existing.counted_cash);
        setNotes(res.data.data.existing.notes || '');
      } else {
        setOpening('');
        setCounted('');
        setNotes('');
      }
    } catch { toast.error('Failed to load day summary'); }
  }, [date]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await listDayClosingsApi({ limit: 10 });
      setHistory(res.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const opening = parseFloat(openingCash) || 0;
  const counted = parseFloat(countedCash) || 0;
  const cashIn  = summary?.cash_in  || 0;
  const cashOut = summary?.cash_out || 0;
  const expectedCash = Math.round((opening + cashIn - cashOut) * 100) / 100;
  const variance = Math.round((counted - expectedCash) * 100) / 100;

  async function handleSubmit(e) {
    e.preventDefault();
    if (existing) return;
    if (!confirm(`Close the day ${date}? This will lock the day's reconciliation snapshot.`)) return;
    setSubmitting(true);
    try {
      await createDayClosingApi({
        business_date: date,
        opening_cash: opening,
        counted_cash: counted,
        notes: notes.trim() || undefined,
      });
      toast.success('Day closed');
      fetchSummary();
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close day');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Day Closing</h1>
          <p className="text-sm text-gray-500">End-of-day cash reconciliation</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Business date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={ymd(new Date())}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {existing && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <HiOutlineLockClosed className="h-5 w-5 flex-shrink-0" />
          <span>This day was closed on <strong>{new Date(existing.createdAt).toLocaleString('en-IN')}</strong> by <strong>{existing.closedBy?.first_name} {existing.closedBy?.last_name}</strong>. The form is read-only below.</span>
        </div>
      )}

      {/* Live summary */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <HiOutlineDocumentReport className="h-4 w-4 text-primary-600" /> Day's activity
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Sales count"     value={summary.total_sales_count} />
              <Row label="Sales amount"    value={fmt(summary.total_sales_amount)} />
              <Row label="Purchases count"  value={summary.total_purchases_count} />
              <Row label="Purchases amount" value={fmt(summary.total_purchases_amount)} />
              <hr className="my-2" />
              <Row label="Total received" value={fmt(summary.total_received)} valueClass="text-green-700 font-semibold" />
              <Row label="Total paid out" value={fmt(summary.total_paid)}     valueClass="text-red-600 font-semibold" />
              {summary.by_method.length > 0 && (
                <div className="mt-3 space-y-1 rounded-lg bg-gray-50 p-3 text-xs">
                  <p className="mb-1 font-semibold text-gray-500 uppercase tracking-wider">By method</p>
                  {summary.by_method.map((m, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-gray-600">
                        <span className={m.direction === 'IN' ? 'text-green-600' : 'text-red-600'}>{m.direction === 'IN' ? '↓' : '↑'}</span>{' '}
                        {m.method}
                      </span>
                      <span className="tabular-nums font-medium">{fmt(m.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <HiOutlineCash className="h-4 w-4 text-primary-600" /> Cash drawer
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Opening cash</label>
                <input type="number" min="0" step="0.01" value={openingCash} disabled={!!existing}
                  onChange={(e) => setOpening(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50" />
              </div>
              <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-xs">
                <Row label="Opening cash"          value={fmt(opening)} />
                <Row label="+ Cash received today" value={fmt(cashIn)} />
                <Row label="− Cash paid out today" value={fmt(cashOut)} />
                <hr className="my-1" />
                <Row label="Expected cash" value={fmt(expectedCash)} valueClass="font-semibold" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Counted cash</label>
                <input type="number" min="0" step="0.01" value={countedCash} disabled={!!existing}
                  onChange={(e) => setCounted(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50" />
              </div>
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
                variance === 0 ? 'bg-gray-50 text-gray-700' :
                variance > 0   ? 'bg-blue-50 text-blue-700' :
                                  'bg-red-50 text-red-700'
              }`}>
                <span>Variance</span>
                <span className="tabular-nums">{variance > 0 ? '+' : ''}{fmt(variance)}</span>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Notes</label>
                <textarea value={notes} disabled={!!existing} onChange={(e) => setNotes(e.target.value)}
                  rows={2} placeholder="Optional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50 resize-none" />
              </div>
              <button type="submit" disabled={submitting || !!existing}
                className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {existing ? 'Day already closed' : submitting ? 'Closing...' : 'Close Day'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Closing history</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Sales</th>
                <th className="px-5 py-3 text-right">Received</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Expected Cash</th>
                <th className="px-5 py-3 text-right">Counted Cash</th>
                <th className="px-5 py-3 text-right">Variance</th>
                <th className="px-5 py-3">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{h.business_date}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmt(h.total_sales_amount)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-green-700">{fmt(h.total_received)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-red-600">{fmt(h.total_paid)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmt(h.expected_cash)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmt(h.counted_cash)}</td>
                  <td className={`px-5 py-3 text-right tabular-nums font-semibold ${
                    parseFloat(h.variance) === 0 ? 'text-gray-600' :
                    parseFloat(h.variance) > 0   ? 'text-blue-600' : 'text-red-600'
                  }`}>{parseFloat(h.variance) > 0 ? '+' : ''}{fmt(h.variance)}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{h.closedBy?.first_name} {h.closedBy?.last_name}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan="8" className="px-5 py-8 text-center text-gray-400">No closings yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

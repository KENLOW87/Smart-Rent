'use client';

import { useRouter } from 'next/navigation';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PeriodPicker({
  year, month, filter, years,
}: {
  year: number; month: number; filter: string; years: number[];
}) {
  const router = useRouter();
  const go = (y: number, m: number) =>
    router.push(`/dashboard/payments?y=${y}&m=${m}&filter=${filter}`);

  return (
    <div className="flex gap-2">
      <select value={month} onChange={(e) => go(year, Number(e.target.value))}
        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
        {MONTHS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
      </select>
      <select value={year} onChange={(e) => go(Number(e.target.value), month)}
        className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

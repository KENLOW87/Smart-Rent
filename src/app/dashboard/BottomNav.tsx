'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/properties', label: 'Properties', icon: '🏘️' },
  { href: '/dashboard/payments', label: 'Payments', icon: '💰' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav({ role }: { role: string }) {
  const path = usePathname();
  const items = role === 'agent'
    ? ITEMS.filter((i) => i.href !== '/dashboard/settings')
    : ITEMS;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 flex justify-around py-2 z-10">
      {items.map((item) => {
        const active = path === item.href;
        return (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center gap-0.5 text-[10px] py-1 px-4 ${
              active ? 'text-blue-600 font-semibold' : 'text-slate-500'
            }`}>
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

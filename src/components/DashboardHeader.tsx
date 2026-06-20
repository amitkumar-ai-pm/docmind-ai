'use client';

import { signOut } from 'next-auth/react';
import { displayUserName } from '@/lib/constants';

interface DashboardHeaderProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
}

export default function DashboardHeader({ userName, userEmail }: DashboardHeaderProps) {
  const name = displayUserName(userName, userEmail);
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5a1.125 1.125 0 001.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">DocMind AI</h1>
            <p className="text-xs text-slate-500">Learn using AI and expand your knowledge</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full bg-slate-100 py-1 pl-1 pr-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
              {initials}
            </div>
            <span className="text-sm font-medium text-slate-700">{name}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

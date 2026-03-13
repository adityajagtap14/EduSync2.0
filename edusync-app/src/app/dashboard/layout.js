'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';

function DashboardShell({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('edusync_user');
    if (!stored) {
      router.replace('/');
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch {
      localStorage.removeItem('edusync_user');
      router.replace('/');
    }
  }, [router]);

  if (!mounted || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar role={user.role} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <ToastProvider>
      <DashboardShell>{children}</DashboardShell>
    </ToastProvider>
  );
}

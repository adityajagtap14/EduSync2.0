'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = {
  unified: [
    { href: '/dashboard/unified', icon: 'fa-chart-pie', label: 'Dashboard' },
    { href: '/dashboard/dean', icon: 'fa-users', label: 'Faculty Roster' },
  ],
  dean: [
    { href: '/dashboard/unified', icon: 'fa-chart-pie', label: 'Dashboard' },
    { href: '/dashboard/dean', icon: 'fa-users', label: 'Faculty Roster' },
  ],
  faculty: [
    { href: '/dashboard/faculty', icon: 'fa-user-clock', label: 'My Workload' },
  ],
  admin: [
    { href: '/dashboard/admin', icon: 'fa-sliders', label: 'Settings' },
    { href: '/dashboard/dean', icon: 'fa-users', label: 'Faculty Roster' },
  ],
};

export default function Sidebar({ role = 'unified' }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV_ITEMS[role] || NAV_ITEMS.unified;

  const handleLogout = () => {
    localStorage.removeItem('edusync_user');
    router.replace('/');
  };

  return (
    <nav className="sidebar">
      <div className="logo">
        <i className="fa-solid fa-building-columns"></i>
        EduSync.
      </div>

      {items.map((item, i) => (
        <Link
          key={i}
          href={item.href}
          className={`nav-item ${pathname === item.href ? 'active' : ''}`}
        >
          <i className={`fa-solid ${item.icon}`}></i>
          {item.label}
        </Link>
      ))}

      <div
        className="nav-item"
        style={{ marginTop: 'auto', color: 'var(--danger)', cursor: 'pointer' }}
        onClick={handleLogout}
      >
        <i className="fa-solid fa-right-from-bracket"></i>
        Logout
      </div>
    </nav>
  );
}

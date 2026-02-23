'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  TrendingUp,
  Gift,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const menuItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Pending Review', href: '/pending', icon: Clock, badge: true },
  { name: 'Auto Approved', href: '/auto-approved', icon: Zap },
  { name: 'Manually Approved', href: '/approved', icon: CheckCircle2 },
  { name: 'Rejected', href: '/rejected', icon: XCircle },
  { name: 'Sanctions & PEP', href: '/sanctions', icon: Shield },
  { name: 'Executive Review', href: '/executive-review', icon: TrendingUp, divider: true },
  { name: 'Referral Program', href: '/referrals', icon: Gift },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchPendingCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchPendingCount() {
    try {
      const response = await fetch('/api/customers?status=pending_all&limit=0');
      const data = await response.json();
      if (data.success) {
        setPendingCount(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
    }
  }

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col transition-all duration-300`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex flex-col items-center gap-4">
          <div className={`${collapsed ? 'w-12 h-12' : 'w-24 h-24'} rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300`}>
            <Image
              src="/zblogo.png"
              alt="Zemen Bank Logo"
              width={collapsed ? 48 : 96}
              height={collapsed ? 48 : 96}
              className="object-contain"
            />
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item, index) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <div key={item.name}>
              {item.divider && <div className="border-t border-slate-700/50 my-3"></div>}
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative ${
                  isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/25'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {!collapsed && (
                  <>
                    <span className="font-medium flex-1">{item.name}</span>
                    {item.badge && pendingCount > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {pendingCount}
                      </span>
                    )}
                  </>
                )}
                {collapsed && item.badge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-slate-700/50">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">K</span>
          </div>
          {!collapsed && (
            <div className="flex-1">
              <p className="text-white font-medium text-sm">KYC Officer</p>
              <p className="text-slate-400 text-xs">kyc@zemenbank.com</p>
            </div>
          )}
          {!collapsed && (
            <button className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-red-400 transition-colors">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

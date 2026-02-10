"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Globe, History, Settings, ChevronLeft, ChevronRight, Sun, Moon, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <Link href="/" className="text-lg font-bold tracking-tight font-mono">
            NameDrop
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Search size={18} />
          {!collapsed && (
            <span className="flex-1 flex items-center justify-between">
              Search
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">
                {"\u2318"}K
              </kbd>
            </span>
          )}
        </button>
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border space-y-2">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          title={mounted ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : undefined}
        >
          {mounted && theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{mounted && theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        {!collapsed && (
          <p className="text-xs text-muted-foreground px-3">NameDrop v0.1.0</p>
        )}
      </div>
    </aside>
  );
}

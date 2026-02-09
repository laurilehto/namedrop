"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export function SetupBanner() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show on setup page or API routes
    if (pathname === "/setup" || pathname.startsWith("/api")) return;

    fetch("/api/settings")
      .then((r) => r.json())
      .then((settings) => {
        if (settings.setup_completed !== "true") {
          setShow(true);
        }
      })
      .catch(() => {
        // Ignore errors
      });
  }, [pathname]);

  if (!show) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-primary" />
        <span>
          Welcome to NameDrop! Complete the setup wizard to get started.
        </span>
      </div>
      <Link
        href="/setup"
        className="text-primary hover:underline font-medium"
      >
        Start Setup
      </Link>
    </div>
  );
}

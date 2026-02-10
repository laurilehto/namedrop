"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { SetupBanner } from "@/components/SetupBanner";
import { SearchDialog } from "@/components/SearchDialog";

const BARE_ROUTES = ["/login", "/setup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.some((r) => pathname === r);

  if (isBare) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <SetupBanner />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      <SearchDialog />
    </>
  );
}

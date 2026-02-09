"use client";

import { useEffect, useState } from "react";
import { Globe, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsWidget } from "@/components/StatsWidget";
import { StatusBadge } from "@/components/StatusBadge";
import { TimelineEntry } from "@/components/TimelineEntry";
import Link from "next/link";

interface Stats {
  total: number;
  statusCounts: Record<string, number>;
  recentChanges: Array<{
    id: string;
    domainId: string;
    domain: string;
    fromStatus: string | null;
    toStatus: string;
    timestamp: string;
  }>;
  upcomingExpirations: Array<{
    id: string;
    domain: string;
    expiryDate: string;
    currentStatus: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Domain monitoring overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsWidget title="Total Domains" value={stats.total} icon={Globe} />
        <StatsWidget
          title="Available"
          value={stats.statusCounts.available || 0}
          icon={TrendingUp}
          description="Domains ready to register"
        />
        <StatsWidget
          title="Expiring Soon"
          value={stats.statusCounts.expiring_soon || 0}
          icon={AlertTriangle}
          description="Within threshold"
        />
        <StatsWidget
          title="Pending Delete"
          value={stats.statusCounts.pending_delete || 0}
          icon={Clock}
          description="About to drop"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.statusCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No domains yet.{" "}
                <Link href="/domains/add" className="underline">
                  Add some
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="font-mono text-sm">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upcoming Expirations</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcomingExpirations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming expirations</p>
            ) : (
              <div className="space-y-3">
                {stats.upcomingExpirations.map((d) => (
                  <div key={d.id} className="flex items-center justify-between">
                    <Link
                      href={`/domains/${d.id}`}
                      className="font-mono text-sm hover:underline truncate"
                    >
                      {d.domain}
                    </Link>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {new Date(d.expiryDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Status Changes (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent changes</p>
          ) : (
            <div>
              {stats.recentChanges.map((entry) => (
                <TimelineEntry
                  key={entry.id}
                  domain={entry.domain}
                  fromStatus={entry.fromStatus}
                  toStatus={entry.toStatus}
                  timestamp={entry.timestamp}
                  eventType="status_change"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimelineEntry } from "@/components/TimelineEntry";

interface HistoryEntry {
  id: string;
  domainId: string;
  domain: string;
  fromStatus: string | null;
  toStatus: string;
  eventType: string;
  timestamp: string;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/history?page=${page}&limit=50`)
      .then((r) => r.json())
      .then((data) => setEntries(data.entries))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">Global timeline of all status changes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history entries yet</p>
          ) : (
            <div>
              {entries.map((entry) => (
                <TimelineEntry
                  key={entry.id}
                  domain={entry.domain}
                  fromStatus={entry.fromStatus}
                  toStatus={entry.toStatus}
                  timestamp={entry.timestamp}
                  eventType={entry.eventType}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={entries.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

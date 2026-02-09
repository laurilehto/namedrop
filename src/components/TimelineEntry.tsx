import { StatusBadge } from "./StatusBadge";
import { ArrowRight } from "lucide-react";

interface TimelineEntryProps {
  domain: string;
  fromStatus: string | null;
  toStatus: string;
  timestamp: string;
  eventType: string;
}

export function TimelineEntry({ domain, fromStatus, toStatus, timestamp, eventType }: TimelineEntryProps) {
  const date = new Date(timestamp);
  const timeStr = date.toLocaleString();

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm truncate">{domain}</p>
        <p className="text-xs text-muted-foreground">{timeStr}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {eventType === "status_change" && fromStatus ? (
          <>
            <StatusBadge status={fromStatus} />
            <ArrowRight size={14} className="text-muted-foreground" />
            <StatusBadge status={toStatus} />
          </>
        ) : (
          <StatusBadge status={toStatus} />
        )}
      </div>
    </div>
  );
}

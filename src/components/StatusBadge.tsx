import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  unknown: { label: "Unknown", className: "bg-zinc-600 text-zinc-100 hover:bg-zinc-600" },
  registered: { label: "Registered", className: "bg-red-900/80 text-red-200 hover:bg-red-900/80" },
  expiring_soon: { label: "Expiring Soon", className: "bg-yellow-900/80 text-yellow-200 hover:bg-yellow-900/80" },
  grace_period: { label: "Grace Period", className: "bg-orange-900/80 text-orange-200 hover:bg-orange-900/80" },
  redemption: { label: "Redemption", className: "bg-orange-800/80 text-orange-200 hover:bg-orange-800/80" },
  pending_delete: { label: "Pending Delete", className: "bg-blue-900/80 text-blue-200 hover:bg-blue-900/80" },
  available: { label: "Available", className: "bg-green-900/80 text-green-200 hover:bg-green-900/80" },
  error: { label: "Error", className: "bg-zinc-700 text-zinc-300 hover:bg-zinc-700" },
};

export function StatusBadge({ status, size = "default" }: { status: string; size?: "default" | "lg" }) {
  const config = statusConfig[status] || statusConfig.unknown;
  return (
    <Badge
      className={cn(
        config.className,
        "font-mono",
        size === "lg" && "text-sm px-3 py-1"
      )}
    >
      {config.label}
    </Badge>
  );
}

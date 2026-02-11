"use client";

import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw, ExternalLink, Zap } from "lucide-react";
import type { Domain } from "@/lib/schema";

interface RegistrarOption {
  adapterName: string;
  displayName: string;
}

interface DomainTableProps {
  domains: Domain[];
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
  checking: string | null;
  registrars?: RegistrarOption[];
  onAutoRegChange?: (id: string, adapter: string) => void;
}

export function DomainTable({ domains, onCheck, onDelete, checking, registrars, onAutoRegChange }: DomainTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Domain</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Expiry</TableHead>
          <TableHead className="hidden md:table-cell">Last Checked</TableHead>
          <TableHead className="hidden lg:table-cell">Priority</TableHead>
          <TableHead className="hidden lg:table-cell">Auto-Reg</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {domains.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No domains found.{" "}
              <Link href="/domains/add" className="underline">
                Add your first domain
              </Link>
            </TableCell>
          </TableRow>
        ) : (
          domains.map((domain) => (
            <TableRow key={domain.id}>
              <TableCell>
                <Link
                  href={`/domains/${domain.id}`}
                  className="font-mono text-sm hover:underline flex items-center gap-1"
                >
                  {domain.domain}
                  <ExternalLink size={12} className="text-muted-foreground" />
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge status={domain.currentStatus} />
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {domain.expiryDate
                  ? new Date(domain.expiryDate).toLocaleDateString()
                  : "-"}
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {domain.lastChecked
                  ? new Date(domain.lastChecked).toLocaleString()
                  : "Never"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm">
                {domain.priority === 1 ? (
                  <span className="text-yellow-400">High</span>
                ) : (
                  <span className="text-muted-foreground">Normal</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm">
                {registrars && onAutoRegChange ? (
                  <select
                    value={domain.registrarAdapter || ""}
                    onChange={(e) => onAutoRegChange(domain.id, e.target.value)}
                    className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Off</option>
                    {registrars.map((r) => (
                      <option key={r.adapterName} value={r.adapterName}>
                        {r.displayName}
                      </option>
                    ))}
                  </select>
                ) : domain.autoRegister && domain.registrarAdapter ? (
                  <span className="flex items-center gap-1 text-green-400" title={domain.registrarAdapter}>
                    <Zap size={12} />
                    {domain.registrarAdapter}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onCheck(domain.id)}
                    disabled={checking === domain.id}
                    title="Check now"
                  >
                    <RefreshCw
                      size={14}
                      className={checking === domain.id ? "animate-spin" : ""}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(domain.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

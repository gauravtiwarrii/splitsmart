"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";

interface LogUser {
  id: string;
  name: string;
  email: string;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: LogUser;
}

export default function AuditPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const actions = ["CREATE", "UPDATE", "DELETE", "IMPORT", "SETTLE"];
  const entityTypes = ["Group", "GroupMember", "Expense", "Settlement", "ImportSession"];

  useEffect(() => {
    fetchAuditLogs();
  }, [page, selectedAction, selectedEntityType]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      let url = `/api/audit?page=${page}&limit=20`;
      if (selectedAction) url += `&action=${selectedAction}`;
      if (selectedEntityType) url += `&entityType=${selectedEntityType}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotalPages(data.pagination.totalPages);
      } else {
        toast({
          variant: "destructive",
          title: "Error loading audit trail",
          description: data.error || "Could not load logs.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection error",
        description: "Failed to connect to the server.",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogId((prev) => (prev === logId ? null : logId));
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "DELETE":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "SETTLE":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "IMPORT":
        return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
      default:
        return "bg-slate-900 text-slate-400 border border-slate-800";
    }
  };

  return (
    <div className="relative space-y-6 max-w-5xl mx-auto text-slate-100 pb-12 min-h-full">
      {/* Background ambient glowing spheres */}
      <div className="premium-glow-bg top-0 right-1/4" />
      <div className="premium-glow-bg bottom-10 left-1/4" style={{ animationDelay: "2s" }} />

      {/* Header */}
      <div className="relative z-10">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Audit Trail</h1>
        <p className="text-muted-foreground text-sm font-medium mt-1">Full transparency logs tracking data insertions, deletions, and updates across your groups.</p>
      </div>

      {/* Filters Panel */}
      <Card className="premium-card border-none overflow-hidden relative z-10">
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Filter Action</label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl bg-muted/10 border border-border/20 p-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:bg-slate-900 outline-none h-[38px]"
            >
              <option value="">All Actions</option>
              {actions.map((act) => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Entity Type</label>
            <select
              value={selectedEntityType}
              onChange={(e) => {
                setSelectedEntityType(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl bg-muted/10 border border-border/20 p-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:bg-slate-900 outline-none h-[38px]"
            >
              <option value="">All Entities</option>
              {entityTypes.map((ent) => (
                <option key={ent} value={ent}>{ent}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedAction("");
                setSelectedEntityType("");
                setPage(1);
              }}
              className="w-full border-border/30 hover:bg-slate-900/40 text-muted-foreground text-xs py-2.5 h-[38px] rounded-xl cursor-pointer"
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs timeline list */}
      {loading ? (
        <div className="space-y-3.5 relative z-10">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16 w-full bg-muted/40 rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="premium-card border-none border-dashed border-border/30 bg-muted/5 py-20 text-center flex flex-col items-center justify-center relative z-10">
          <Activity className="text-muted-foreground mb-4 opacity-60" size={48} />
          <h3 className="text-lg font-bold text-slate-200">No logs found</h3>
          <p className="text-muted-foreground max-w-sm mt-1 text-sm font-medium">
            No system audit logs match your selected filter criteria.
          </p>
        </Card>
      ) : (
        <div className="space-y-3.5 relative z-10">
          {logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <Card
                key={log.id}
                className="premium-card border-none overflow-hidden"
              >
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <Badge className={getActionBadgeColor(log.action)} style={{ fontSize: "9px", padding: "1px 6px" }}>
                      {log.action}
                    </Badge>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-200">
                        {log.entityType} ID: <span className="text-muted-foreground font-mono text-[10px]">{log.entityId}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold uppercase tracking-wider">
                        <span className="text-slate-400 font-semibold lowercase">by {log.user.name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 lowercase">
                          <Calendar size={11} />
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-xs border-t sm:border-t-0 pt-2 sm:pt-0 border-border/10">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider hidden sm:inline">
                      {isExpanded ? "Collapse details" : "Expand details"}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-border/10 bg-slate-900/10 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-4">
                      {log.oldValue && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Previous Value</span>
                          <pre className="bg-slate-950/80 p-3 rounded-xl border border-border/10 overflow-x-auto text-[10px] text-slate-355 font-mono max-h-48">
                            {JSON.stringify(log.oldValue, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValue && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">New Value</span>
                          <pre className="bg-slate-950/80 p-3 rounded-xl border border-border/10 overflow-x-auto text-[10px] text-slate-355 font-mono max-h-48">
                            {JSON.stringify(log.newValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    {log.metadata && (
                      <div className="space-y-1.5 text-xs">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Log Metadata</span>
                        <pre className="bg-slate-950/80 p-3 rounded-xl border border-border/10 overflow-x-auto text-[10px] text-slate-355 font-mono max-h-24">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

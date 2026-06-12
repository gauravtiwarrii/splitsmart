"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Plus,
  Calendar,
  Wallet,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";

interface GroupBrief {
  id: string;
  name: string;
  currency: "INR" | "USD";
}

interface MemberBrief {
  userId: string;
  user: {
    name: string;
  };
}

interface Settlement {
  id: string;
  amount: number;
  currency: "INR" | "USD";
  notes: string | null;
  settledAt: string;
  payer: { id: string; name: string };
  receiver: { id: string; name: string };
  group: { id: string; name: string };
}

export default function SettlementsPage() {
  const { toast } = useToast();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [groups, setGroups] = useState<GroupBrief[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedGroup, setSelectedGroup] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Record Settlement Modal State
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settleGroup, setSettleGroup] = useState("");
  const [groupMembers, setGroupMembers] = useState<MemberBrief[]>([]);
  const [settlePayer, setSettlePayer] = useState("");
  const [settleReceiver, setSettleReceiver] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [recordingSettlement, setRecordingSettlement] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchSettlements();
  }, [selectedGroup]);

  useEffect(() => {
    if (settleGroup) {
      fetchGroupMembers(settleGroup);
    } else {
      setGroupMembers([]);
    }
  }, [settleGroup]);

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) {
        setGroups(data.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchGroupMembers = async (gid: string) => {
    try {
      const res = await fetch(`/api/groups/${gid}`);
      const data = await res.json();
      if (data.success) {
        setGroupMembers(data.data.members.filter((m: { isActive: boolean }) => m.isActive));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      let url = "/api/settlements";
      if (selectedGroup) url += `?groupId=${selectedGroup}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setSettlements(data.data);
      } else {
        toast({
          variant: "destructive",
          title: "Error fetching settlements",
          description: data.error || "Could not load data.",
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

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleGroup || !settlePayer || !settleReceiver || !settleAmount || parseFloat(settleAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Please check all fields are entered correctly.",
      });
      return;
    }

    try {
      setRecordingSettlement(true);
      const selectedG = groups.find((g) => g.id === settleGroup);
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: settleGroup,
          payerId: settlePayer,
          receiverId: settleReceiver,
          amount: parseFloat(settleAmount),
          currency: selectedG?.currency || "INR",
          notes: settleNotes || `Settlement from general ledger`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Settlement recorded",
          description: "Payout recorded successfully.",
        });
        setIsSettleOpen(false);
        setSettleGroup("");
        setSettlePayer("");
        setSettleReceiver("");
        setSettleAmount("");
        setSettleNotes("");
        fetchSettlements();
      } else {
        toast({
          variant: "destructive",
          title: "Recording failed",
          description: data.error || "Could not save settlement.",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setRecordingSettlement(false);
    }
  };

  const filteredSettlements = settlements.filter((setl) =>
    setl.payer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    setl.receiver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    setl.group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative space-y-6 max-w-7xl mx-auto pb-12 min-h-full">
      {/* Background ambient glowing spheres */}
      <div className="premium-glow-bg top-0 right-1/4" />
      <div className="premium-glow-bg bottom-10 left-1/4" style={{ animationDelay: "2s" }} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Settlement History</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Log and view direct paybacks and payouts recorded between group members.</p>
        </div>

        <Button
          onClick={() => setIsSettleOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-955 font-bold shadow-lg shadow-emerald-500/10 gap-2 transition-all hover:scale-105 duration-300 cursor-pointer"
        >
          <Plus size={18} />
          Record Settlement
        </Button>
      </div>

      {/* Filter Options */}
      <Card className="premium-card border-none overflow-hidden relative z-10">
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Search settlements</Label>
            <div className="flex items-center space-x-3 bg-muted/10 border border-border/20 focus-within:border-primary/40 px-3.5 py-2.5 rounded-xl transition-all duration-300">
              <Search size={16} className="text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member name or group..."
                className="bg-transparent border-0 outline-none w-full text-xs text-slate-200 placeholder-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Filter by Group</Label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full rounded-xl bg-muted/10 border border-border/20 p-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:bg-slate-900 outline-none h-[38px]"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedGroup("");
                setSearchQuery("");
              }}
              className="w-full border-border/30 hover:bg-slate-900/40 text-muted-foreground text-xs py-2.5 h-[38px] rounded-xl cursor-pointer"
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settlements Grid List */}
      {loading ? (
        <div className="space-y-3.5 relative z-10">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16 w-full bg-muted/40 rounded-xl" />
          ))}
        </div>
      ) : filteredSettlements.length === 0 ? (
        <Card className="premium-card border-none border-dashed border-border/30 bg-muted/5 py-16 text-center flex flex-col items-center justify-center relative z-10">
          <History className="text-muted-foreground mb-4 opacity-60" size={48} />
          <h3 className="text-lg font-bold text-slate-200">No settlements logged</h3>
          <p className="text-muted-foreground max-w-sm mt-1 mb-6 text-sm font-medium">
            {searchQuery || selectedGroup
              ? "No settlements match your current filters."
              : "No direct paybacks have been logged in your accounts yet."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 relative z-10">
          {filteredSettlements.map((setl) => (
            <div
              key={setl.id}
              className="premium-card border-none flex items-center justify-between p-4.5 shadow-md rounded-2xl"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Wallet size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-200">
                    {setl.payer.name} paid {setl.receiver.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-medium">
                    <span className="italic text-slate-400">"{setl.notes}"</span>
                    <span className="text-muted-foreground/60">in</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 px-2.5 py-0.5 border-emerald-500/20 bg-emerald-500/5">
                      {setl.group.name}
                    </Badge>
                    <span className="text-muted-foreground/60">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(setl.settledAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right font-extrabold text-emerald-400 text-base sm:text-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
                {formatCurrency(setl.amount, setl.currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Settlement Dialog */}
      <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
        <DialogContent className="sm:max-w-[425px] bg-slate-950 border border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-100">Record a Settlement</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select a group ledger, specify the sender (debtor) and recipient (creditor), and save the payback transaction.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordSettlement} className="space-y-4 pt-4">
            {/* Group Selector */}
            <div className="space-y-2">
              <Label htmlFor="settle-group" className="text-slate-200">Group Ledger</Label>
              <select
                id="settle-group"
                required
                value={settleGroup}
                onChange={(e) => {
                  setSettleGroup(e.target.value);
                  setSettlePayer("");
                  setSettleReceiver("");
                }}
                className="w-full rounded-md bg-slate-900 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none"
              >
                <option value="">Select a group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Payer */}
              <div className="space-y-2">
                <Label htmlFor="settle-payer" className="text-slate-200">Sender</Label>
                <select
                  id="settle-payer"
                  required
                  disabled={!settleGroup}
                  value={settlePayer}
                  onChange={(e) => setSettlePayer(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none disabled:opacity-40"
                >
                  <option value="">Select payer</option>
                  {groupMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.name}</option>
                  ))}
                </select>
              </div>

              {/* Receiver */}
              <div className="space-y-2">
                <Label htmlFor="settle-receiver" className="text-slate-200">Recipient</Label>
                <select
                  id="settle-receiver"
                  required
                  disabled={!settleGroup}
                  value={settleReceiver}
                  onChange={(e) => setSettleReceiver(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none disabled:opacity-40"
                >
                  <option value="">Select receiver</option>
                  {groupMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="settle-amount" className="text-slate-200">Amount</Label>
              <Input
                id="settle-amount"
                type="number"
                step="0.01"
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="0.00"
                className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="settle-notes" className="text-slate-200">Notes</Label>
              <Input
                id="settle-notes"
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
                placeholder="e.g. Bank transfer, cash paid, Google Pay"
                className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSettleOpen(false)}
                className="border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordingSettlement || !settleGroup}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold"
              >
                {recordingSettlement ? "Recording..." : "Save Settlement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

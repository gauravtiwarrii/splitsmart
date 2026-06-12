"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Users,
  Receipt,
  ArrowRight,
  Search,
  FolderPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface GroupStats {
  id: string;
  name: string;
  description: string | null;
  currency: "INR" | "USD";
  createdAt: string;
  memberCount: number;
  totalExpenses: number;
  totalSettlements: number;
  members: Array<{
    userId: string;
    role: "ADMIN" | "MEMBER";
    user: {
      name: string;
      email: string;
      image: string | null;
    };
  }>;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // New Group Form State
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupCurrency, setNewGroupCurrency] = useState<"INR" | "USD">("INR");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) {
        setGroups(data.data);
      } else {
        toast({
          variant: "destructive",
          title: "Error fetching groups",
          description: data.error || "Something went wrong.",
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

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Group name is required.",
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDesc,
          currency: newGroupCurrency,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Group created",
          description: `"${newGroupName}" created successfully!`,
        });
        setIsOpen(false);
        setNewGroupName("");
        setNewGroupDesc("");
        setNewGroupCurrency("INR");
        fetchGroups();
      } else {
        toast({
          variant: "destructive",
          title: "Creation failed",
          description: data.error || "Could not create group.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection error",
        description: "Failed to connect to the server.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative space-y-6 max-w-7xl mx-auto min-h-full">
      {/* Subtle background wash */}
      <div className="premium-glow-bg top-0 right-1/4" />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">My Groups</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Track and manage your shared expenses with friends and flatmates.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold shadow-sm gap-2 transition-all cursor-pointer">
              <Plus size={18} />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-slate-950 border border-slate-800 text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-100">Create New Group</DialogTitle>
              <DialogDescription className="text-slate-400">
                Set up a new shared ledger for rent, bills, trips, or roommate expenses.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateGroup} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-200">Group Name</Label>
                <Input
                  id="name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. 5B Flatmates, Goa Trip 2025"
                  className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-200">Description (Optional)</Label>
                <Input
                  id="description"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Shared expenses for flat rent and bills"
                  className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-slate-200">Base Currency</Label>
                <Select
                  value={newGroupCurrency}
                  onValueChange={(val) => setNewGroupCurrency(val as "INR" | "USD")}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100">
                    <SelectValue placeholder="Select Currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border border-slate-800 text-slate-100">
                    <SelectItem value="INR" className="focus:bg-emerald-600 focus:text-slate-950">INR (₹)</SelectItem>
                    <SelectItem value="USD" className="focus:bg-emerald-600 focus:text-slate-950">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold"
                >
                  {submitting ? "Creating..." : "Create Group"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats Overview */}
      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
          <Card className="premium-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Active Groups</CardTitle>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Users size={16} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{groups.length}</div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Across all shared circles</p>
            </CardContent>
          </Card>
          <Card className="premium-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Recorded Expenses</CardTitle>
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20">
                <Receipt size={16} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">
                {groups.reduce((acc, curr) => acc + curr.totalExpenses, 0)}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Logged transaction entries</p>
            </CardContent>
          </Card>
          <Card className="premium-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settled Transactions</CardTitle>
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                <Wallet size={16} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">
                {groups.reduce((acc, curr) => acc + curr.totalSettlements, 0)}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Successfully recorded payouts</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex items-center space-x-3 bg-muted/15 border border-border/60 focus-within:border-primary/40 px-3.5 py-2.5 rounded-xl max-w-md backdrop-blur-md transition-all duration-305 relative z-10">
        <Search className="text-muted-foreground" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search groups by name..."
          className="bg-transparent border-0 outline-none w-full text-sm text-slate-200 placeholder-muted-foreground"
        />
      </div>

      {/* Main Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="premium-card">
              <CardHeader className="space-y-3">
                <Skeleton className="h-6 w-2/3 bg-muted/40" />
                <Skeleton className="h-4 w-full bg-muted/40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-full bg-muted/40" />
                  <Skeleton className="h-10 w-full bg-muted/40" />
                </div>
                <Skeleton className="h-9 w-full bg-muted/40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="premium-card border-dashed border-border bg-muted/5 py-16 text-center flex flex-col items-center justify-center relative z-10">
          <FolderPlus className="text-muted-foreground mb-4 opacity-50" size={48} />
          <h3 className="text-lg font-bold text-slate-200">No groups found</h3>
          <p className="text-muted-foreground max-w-sm mt-1 mb-6 text-sm font-medium">
            {searchQuery ? "No groups match your search term." : "Create your first group or have a friend add you to start tracking expenses."}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => setIsOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold"
            >
              Get Started
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {filteredGroups.map((group) => (
            <Card
              key={group.id}
              className="premium-card flex flex-col overflow-hidden relative"
            >
              <CardHeader className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <CardTitle className="text-xl font-bold text-foreground">
                    {group.name}
                  </CardTitle>
                  <Badge className="bg-secondary text-secondary-foreground border border-border font-medium">
                    {group.currency}
                  </Badge>
                </div>
                <CardDescription className="text-muted-foreground text-sm font-medium line-clamp-2 min-h-[40px]">
                  {group.description || "No description provided."}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 border-t border-border bg-muted/10 p-4 space-y-4">
                {/* Micro Stats inside Card */}
                <div className="grid grid-cols-3 gap-2.5 text-center text-[10px] font-bold uppercase tracking-wider">
                  <div className="p-2.5 bg-slate-900/40 rounded-lg border border-border/80">
                    <div className="text-muted-foreground flex items-center justify-center gap-1 mb-1">
                      <Users size={12} />
                      <span>Members</span>
                    </div>
                    <div className="font-semibold text-sm text-foreground">{group.memberCount}</div>
                  </div>
                  <div className="p-2.5 bg-slate-900/40 rounded-lg border border-border/80">
                    <div className="text-muted-foreground flex items-center justify-center gap-1 mb-1">
                      <Receipt size={12} />
                      <span>Expenses</span>
                    </div>
                    <div className="font-semibold text-sm text-foreground">{group.totalExpenses}</div>
                  </div>
                  <div className="p-2.5 bg-slate-900/40 rounded-lg border border-border/80">
                    <div className="text-muted-foreground flex items-center justify-center gap-1 mb-1">
                      <Wallet size={12} />
                      <span>Settled</span>
                    </div>
                    <div className="font-semibold text-sm text-foreground">{group.totalSettlements}</div>
                  </div>
                </div>

                {/* Avatar stack */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2 overflow-hidden">
                    {group.members.slice(0, 4).map((member, idx) => (
                      <div
                        key={idx}
                        className="inline-block h-6 w-6 rounded-full ring-2 ring-slate-950 bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center border border-border"
                        title={member.user.name}
                      >
                        {member.user.name.substring(0, 2).toUpperCase()}
                      </div>
                    ))}
                    {group.members.length > 4 && (
                      <div className="inline-block h-6 w-6 rounded-full ring-2 ring-slate-950 bg-slate-900 text-[9px] font-bold text-slate-400 flex items-center justify-center border border-border">
                        +{group.members.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                    Active members
                  </span>
                </div>

                <Link href={`/groups/${group.id}`} className="block w-full">
                  <Button
                    variant="outline"
                    className="w-full border-border hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all duration-300 font-bold py-2 gap-2 cursor-pointer rounded-lg text-xs"
                  >
                    Enter Group Ledger
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  CheckCircle,
  Download,
  ArrowRight,
  Loader2,
  Trash2,
  Check,
  AlertCircle,
  Info,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";

interface GroupBrief {
  id: string;
  name: string;
  currency: "INR" | "USD";
}

interface Anomaly {
  id: string;
  rowNumber: number;
  type: string;
  severity: "ERROR" | "WARNING" | "INFO";
  description: string;
  suggestedAction: string;
  rawData: Record<string, string>;
  resolution: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED" | "AUTO_RESOLVED";
}

function ImportWizardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const queryGroupId = searchParams.get("groupId") || "";

  // Stepper State: 1 = Upload, 2 = Review, 3 = Confirm, 4 = Report
  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState<GroupBrief[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(queryGroupId);

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Import Session State
  const [sessionId, setSessionId] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [cleanRows, setCleanRows] = useState(0);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, "APPROVED" | "REJECTED">>({});

  // Execution State
  const [executing, setExecuting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
  } | null>(null);

  // Filter Anomalies inside Review Step
  const [anomalyFilter, setAnomalyFilter] = useState<"ALL" | "ERROR" | "WARNING" | "INFO">("ALL");

  useEffect(() => {
    fetchGroups();
  }, []);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a CSV file.",
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (!file) {
      toast({ variant: "destructive", title: "Missing file", description: "Select a CSV file first." });
      return;
    }
    if (!selectedGroupId) {
      toast({ variant: "destructive", title: "Missing group", description: "Select a group to import into." });
      return;
    }

    try {
      setParsing(true);
      const formData = new FormData();
      formData.append("action", "parse");
      formData.append("file", file);
      formData.append("groupId", selectedGroupId);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSessionId(data.data.sessionId);
        setTotalRows(data.data.totalRows);
        setCleanRows(data.data.cleanRows);
        setAnomalies(data.data.anomalies);

        // Initialize resolutions state (default APPROVED for everything except high level errors)
        const initialResolutions: Record<string, "APPROVED" | "REJECTED"> = {};
        data.data.anomalies.forEach((a: Anomaly) => {
          initialResolutions[a.id] = "APPROVED";
        });
        setResolutions(initialResolutions);

        toast({
          title: "CSV parsed successfully",
          description: `Found ${data.data.totalRows} rows. Anomaly review required for ${data.data.anomalies.length} items.`,
        });

        if (data.data.anomalies.length > 0) {
          setStep(2); // Go to review
        } else {
          setStep(3); // Go directly to confirmation
        }
      } else {
        toast({
          variant: "destructive",
          title: "Parsing failed",
          description: data.error || "Could not parse CSV.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection error",
        description: "Failed to connect to the server.",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleResolveAnomaly = (anomalyId: string, action: "APPROVED" | "REJECTED") => {
    setResolutions((prev) => ({
      ...prev,
      [anomalyId]: action,
    }));
  };

  const submitResolutions = async () => {
    try {
      setParsing(true);
      const formattedResolutions = Object.keys(resolutions).map((anomalyId) => ({
        anomalyId,
        resolution: resolutions[anomalyId],
      }));

      const formData = new FormData();
      formData.append("action", "resolve");
      formData.append("sessionId", sessionId);
      formData.append("resolutions", JSON.stringify(formattedResolutions));

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data.allResolved) {
        setStep(3); // Move to confirm execution
      } else {
        toast({
          variant: "destructive",
          title: "Resolution error",
          description: "Please resolve all items before proceeding.",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    try {
      setExecuting(true);
      const formData = new FormData();
      formData.append("action", "execute");
      formData.append("sessionId", sessionId);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setImportResult(data.data);
        toast({
          title: "Import complete",
          description: `Successfully loaded ${data.data.imported} transactions.`,
        });
        setStep(4); // Go to report screen
      } else {
        toast({
          variant: "destructive",
          title: "Execution failed",
          description: data.error || "Could not load transactions into database.",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setExecuting(false);
    }
  };

  const downloadReport = (format: "pdf" | "json") => {
    window.open(`/api/import/report?sessionId=${sessionId}&format=${format}`, "_blank");
  };

  const filteredAnomalies = anomalies.filter(
    (a) => anomalyFilter === "ALL" || a.severity === anomalyFilter
  );

  const errorCount = anomalies.filter((a) => a.severity === "ERROR").length;
  const warningCount = anomalies.filter((a) => a.severity === "WARNING").length;
  const infoCount = anomalies.filter((a) => a.severity === "INFO").length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-slate-100 pb-12">
      {/* Header and Stepper Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 font-sans">CSV Import Wizard</h1>
          <p className="text-slate-400 text-sm">Upload, review anomalies, resolve splits, and bulk-import expenses.</p>
        </div>
        <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-semibold bg-slate-950 p-2 rounded-lg border border-slate-900 shrink-0">
          <span className={step >= 1 ? "text-emerald-400" : ""}>Upload</span>
          <ChevronRight size={12} />
          <span className={step >= 2 ? "text-emerald-400" : ""}>Review</span>
          <ChevronRight size={12} />
          <span className={step >= 3 ? "text-emerald-400" : ""}>Confirm</span>
          <ChevronRight size={12} />
          <span className={step >= 4 ? "text-emerald-400" : ""}>Report</span>
        </div>
      </div>

      <Progress value={(step / 4) * 100} className="h-1 bg-slate-900 [&>div]:bg-emerald-500" />

      {/* STEP 1: UPLOAD FILE */}
      {step === 1 && (
        <Card className="bg-slate-950/40 border-slate-900 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-200">Upload CSV Ledger</CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              Select a group ledger to import into, and drag or browse your spreadsheet file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Group Selector */}
            <div className="space-y-2 max-w-md">
              <Label htmlFor="group" className="text-slate-200 text-xs font-semibold">Destination Group Ledger</Label>
              <select
                id="group"
                required
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none"
              >
                <option value="">Select a group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragOver ? "border-emerald-500 bg-emerald-950/5" : "border-slate-800 hover:border-slate-700 bg-slate-900/10"
              }`}
            >
              <Upload size={36} className={file ? "text-emerald-400 animate-bounce" : "text-slate-600"} />
              {file ? (
                <div>
                  <p className="font-semibold text-slate-200 text-sm">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-slate-200 text-sm">Drag and drop your CSV file here</p>
                  <p className="text-xs text-slate-500 mt-1">or click to browse local files (CSV only)</p>
                </div>
              )}
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file-input"
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => document.getElementById("csv-file-input")?.click()}
                className="border-slate-800 hover:bg-slate-900 text-slate-300 text-xs py-1.5 h-auto mt-2"
              >
                Browse File
              </Button>
            </div>

            {/* Template Help */}
            <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg text-xs text-slate-400 flex items-start gap-2 max-w-2xl">
              <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block mb-0.5">Spreadsheet Format Requirements</span>
                Your CSV should ideally contain: <code className="text-emerald-400">description</code>, <code className="text-emerald-400">amount</code>, <code className="text-emerald-400">date</code>, <code className="text-emerald-400">paid_by</code>, <code className="text-emerald-400">split_type</code>, and <code className="text-emerald-400">split_between</code> columns. The engine will auto-detect formats, run 12 validation tests, and flag issues for review.
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleParse}
                disabled={parsing || !file || !selectedGroupId}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold gap-2 py-2 shadow-lg shadow-emerald-950/20"
              >
                {parsing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Parsing CSV...
                  </>
                ) : (
                  <>
                    Parse File
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: REVIEW ANOMALIES */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="bg-slate-950/40 border-slate-900 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-200">Resolve Anomalies</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Review flagged issues detected by the validation engine. Errors must be resolved, while warnings can be approved or skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-0">
              {/* Filter Tabs */}
              <div className="flex items-center space-x-1 p-0.5 bg-slate-900 border border-slate-850 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setAnomalyFilter("ALL")}
                  className={`px-3 py-1.5 rounded-md font-semibold ${anomalyFilter === "ALL" ? "bg-emerald-950/40 text-emerald-400" : "text-slate-400"}`}
                >
                  All ({anomalies.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAnomalyFilter("ERROR")}
                  className={`px-3 py-1.5 rounded-md font-semibold ${anomalyFilter === "ERROR" ? "bg-red-950/30 text-red-400" : "text-slate-455"}`}
                >
                  Errors ({errorCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAnomalyFilter("WARNING")}
                  className={`px-3 py-1.5 rounded-md font-semibold ${anomalyFilter === "WARNING" ? "bg-amber-950/30 text-amber-500" : "text-slate-400"}`}
                >
                  Warnings ({warningCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAnomalyFilter("INFO")}
                  className={`px-3 py-1.5 rounded-md font-semibold ${anomalyFilter === "INFO" ? "bg-blue-950/30 text-blue-400" : "text-slate-400"}`}
                >
                  Info ({infoCount})
                </button>
              </div>

              <div className="text-xs text-slate-500 font-semibold">
                Total rows: {totalRows} | Flagged rows: {anomalies.length}
              </div>
            </CardContent>
          </Card>

          {/* Anomalies List */}
          <div className="space-y-3">
            {filteredAnomalies.map((anom) => {
              const resState = resolutions[anom.id] || "APPROVED";
              const isError = anom.severity === "ERROR";
              const isWarning = anom.severity === "WARNING";

              return (
                <div
                  key={anom.id}
                  className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    resState === "REJECTED"
                      ? "bg-red-950/5 border-red-900/10 opacity-60"
                      : "bg-slate-950/30 border-slate-900"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isError ? (
                        <AlertCircle className="text-red-400" size={18} />
                      ) : isWarning ? (
                        <AlertTriangle className="text-amber-500" size={18} />
                      ) : (
                        <Info className="text-blue-400" size={18} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-400">Row #{anom.rowNumber}</span>
                        <Badge
                          className={
                            isError
                              ? "bg-red-950/20 text-red-400 border border-red-950/30"
                              : isWarning
                              ? "bg-amber-950/20 text-amber-500 border border-amber-900/30"
                              : "bg-blue-950/20 text-blue-400 border border-blue-900/30"
                          }
                          style={{ fontSize: "9px", padding: "0 4px" }}
                        >
                          {anom.type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{anom.description}</p>
                      <div className="text-[10px] text-slate-500 font-semibold italic">
                        Raw CSV row data: {JSON.stringify(anom.rawData)}
                      </div>
                      <div className="text-xs text-emerald-400 font-semibold">
                        Suggested Resolution: {anom.suggestedAction}
                      </div>
                    </div>
                  </div>

                  {/* Resolution Controls */}
                  <div className="flex items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-900 shrink-0 justify-end">
                    <Button
                      type="button"
                      onClick={() => handleResolveAnomaly(anom.id, "APPROVED")}
                      variant="outline"
                      className={`py-1 px-3 text-xs h-auto border-slate-800 ${
                        resState === "APPROVED"
                          ? "bg-emerald-950/20 text-emerald-400 border-emerald-800/30"
                          : "hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Check size={12} className="mr-1 inline" />
                      Approve suggestion
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleResolveAnomaly(anom.id, "REJECTED")}
                      variant="outline"
                      className={`py-1 px-3 text-xs h-auto border-slate-800 ${
                        resState === "REJECTED"
                          ? "bg-red-950/20 text-red-400 border-red-800/30"
                          : "hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Trash2 size={12} className="mr-1 inline" />
                      Skip Row
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-4">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            >
              Back to Upload
            </Button>
            <Button
              onClick={submitResolutions}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold gap-1"
            >
              Continue to Confirm
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRM EXECUTION */}
      {step === 3 && (
        <Card className="bg-slate-950/40 border-slate-900 shadow-xl max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-200">Confirm Ledger Import</CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              Resolutions submitted. Check the import preview summary before finalizing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3.5">
              <div className="flex justify-between text-xs border-b border-slate-900 pb-2.5">
                <span className="text-slate-500 font-semibold">Total spreadsheet rows</span>
                <span className="font-bold text-slate-200">{totalRows}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-900 pb-2.5">
                <span className="text-slate-500 font-semibold">Flagged anomalies resolved</span>
                <span className="font-bold text-emerald-400">{anomalies.length}</span>
              </div>
              <div className="flex justify-between text-xs border-b border-slate-900 pb-2.5">
                <span className="text-slate-500 font-semibold">Expected transactions to import</span>
                <span className="font-bold text-slate-200">
                  {totalRows - Object.values(resolutions).filter((r) => r === "REJECTED").length}
                </span>
              </div>
              <div className="flex justify-between text-xs pb-1">
                <span className="text-slate-500 font-semibold">Expected rows skipped (Rejected)</span>
                <span className="font-bold text-red-400">
                  {Object.values(resolutions).filter((r) => r === "REJECTED").length}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/10 border border-emerald-900/15 rounded-lg text-xs text-slate-400 flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block mb-0.5">Database Safe Mode Active</span>
                Importing will run in a single atomic transaction. In case of failure, all ledger updates will roll back safely.
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t border-slate-900">
              <Button
                variant="outline"
                onClick={() => (anomalies.length > 0 ? setStep(2) : setStep(1))}
                className="border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              >
                Go Back
              </Button>
              <Button
                onClick={handleExecuteImport}
                disabled={executing}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold gap-2 shadow-lg shadow-emerald-950/20"
              >
                {executing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Executing Import...
                  </>
                ) : (
                  <>
                    Execute Import
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: IMPORT REPORT / SUCCESS SCREEN */}
      {step === 4 && importResult && (
        <Card className="bg-slate-950/40 border-slate-900 shadow-xl max-w-xl mx-auto text-center py-6">
          <CardContent className="space-y-6 flex flex-col items-center">
            <div className="p-3.5 bg-emerald-950/20 text-emerald-400 rounded-full border border-emerald-900/30 w-fit">
              <CheckCircle size={48} className="animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-200 font-sans">Ledger Import Complete</h3>
              <p className="text-slate-400 text-xs">
                Successfully processed and populated group ledger database rows.
              </p>
            </div>

            {/* Results stats */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-sm text-center text-xs py-3">
              <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
                <div className="text-slate-500 font-medium mb-1">Spreadsheet Rows</div>
                <div className="text-base font-bold text-slate-200">{importResult.total}</div>
              </div>
              <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
                <div className="text-slate-500 font-medium mb-1">Imported</div>
                <div className="text-base font-bold text-emerald-400">{importResult.imported}</div>
              </div>
              <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
                <div className="text-slate-500 font-medium mb-1">Skipped</div>
                <div className="text-base font-bold text-red-400">{importResult.skipped}</div>
              </div>
            </div>

            {/* Reports downloads */}
            <div className="space-y-3.5 w-full max-w-sm border-t border-slate-900/60 pt-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-left">Downloads & Audit</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => downloadReport("pdf")}
                  variant="outline"
                  className="w-full border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold gap-1.5 text-xs py-2 h-auto"
                >
                  <Download size={14} />
                  Download PDF Report
                </Button>
                <Button
                  onClick={() => downloadReport("json")}
                  variant="outline"
                  className="w-full border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold gap-1.5 text-xs py-2 h-auto"
                >
                  <FileSpreadsheet size={14} />
                  JSON Report
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-900 w-full max-w-sm">
              <Button
                onClick={() => router.push(`/groups/${selectedGroupId}`)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold"
              >
                Go to Group Ledger
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ImportWizardPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 p-8 text-center text-xs">Loading import wizard...</div>}>
      <ImportWizardForm />
    </Suspense>
  );
}

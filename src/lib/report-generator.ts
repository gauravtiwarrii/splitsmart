// =============================================================================
// SplitSmart — Report Generator
// =============================================================================
// Generates structured import reports in JSON and PDF formats.
//
// JSON reports are used by the review UI and API responses.
// PDF reports are downloadable documents for offline record-keeping and
// compliance, containing a full summary of the import session with all
// detected anomalies and their resolution status.
// =============================================================================

import { prisma } from "@/lib/db";
import { jsPDF } from "jspdf";
import type { ImportReport, ImportReportAnomaly } from "@/types";

// =============================================================================
// JSON Report
// =============================================================================

/**
 * Generates a structured ImportReport by querying the import session and
 * its associated anomalies from the database.
 *
 * This is the primary data source for the import review page and can also
 * be returned directly from an API endpoint.
 *
 * @param sessionId - The import session ID to generate a report for.
 * @returns A fully populated ImportReport object.
 * @throws Error if the session ID does not exist.
 */
export async function generateJSONReport(
  sessionId: string
): Promise<ImportReport> {
  // Fetch session with all anomalies and the user who initiated it
  const session = await prisma.importSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      anomalies: {
        orderBy: [
          { severity: "asc" }, // ERRORs first, then WARNINGs, then INFOs
          { rowNumber: "asc" },
        ],
        include: {
          resolvedBy: {
            select: { name: true },
          },
        },
      },
      user: {
        select: { name: true, email: true },
      },
    },
  });

  // ── Build anomaly details ──
  const anomalyDetails: ImportReportAnomaly[] = session.anomalies.map(
    (anomaly) => ({
      rowNumber: anomaly.rowNumber,
      type: anomaly.type,
      severity: anomaly.severity,
      description: anomaly.description,
      resolution: anomaly.resolution,
      resolutionNote: anomaly.resolutionNote ?? undefined,
    })
  );

  // ── Count by type ──
  const byType: Record<string, number> = {};
  for (const anomaly of session.anomalies) {
    byType[anomaly.type] = (byType[anomaly.type] ?? 0) + 1;
  }

  // ── Count by severity ──
  const bySeverity: Record<string, number> = {};
  for (const anomaly of session.anomalies) {
    bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] ?? 0) + 1;
  }

  // ── Build summary text ──
  const summaryParts: string[] = [];
  summaryParts.push(
    `Import of "${session.filename}" completed with status: ${session.status}.`
  );
  summaryParts.push(
    `${session.importedRows} of ${session.totalRows} rows imported successfully.`
  );
  if (session.skippedRows > 0) {
    summaryParts.push(`${session.skippedRows} rows were skipped.`);
  }
  if (session.anomalies.length > 0) {
    summaryParts.push(
      `${session.anomalies.length} anomalies were detected (${bySeverity["ERROR"] ?? 0} errors, ${bySeverity["WARNING"] ?? 0} warnings, ${bySeverity["INFO"] ?? 0} info).`
    );
  } else {
    summaryParts.push("No anomalies were detected.");
  }

  return {
    sessionId: session.id,
    filename: session.filename,
    importedAt: session.startedAt,
    importedBy: session.user.name,
    totalRows: session.totalRows,
    importedRows: session.importedRows,
    skippedRows: session.skippedRows,
    anomalies: {
      total: session.anomalies.length,
      byType,
      bySeverity,
      details: anomalyDetails,
    },
    summary: summaryParts.join(" "),
  };
}

// =============================================================================
// PDF Report
// =============================================================================

/**
 * Generates a formatted PDF report from an ImportReport object.
 *
 * Layout:
 *   1. Header — title, date, imported by
 *   2. Summary — total rows, imported, skipped, anomaly counts
 *   3. Anomaly Table — row, type, severity (colour-coded), description,
 *      resolution status
 *
 * Uses jsPDF for PDF generation. The output is an ArrayBuffer that can be
 * sent as a file download response or saved to disk.
 *
 * @param report - The ImportReport data to render.
 * @returns ArrayBuffer containing the PDF binary data.
 */
export function generatePDFReport(report: ImportReport): ArrayBuffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Colours ──
  const colors = {
    primary: [41, 98, 255] as [number, number, number],    // Blue
    error: [220, 53, 69] as [number, number, number],      // Red
    warning: [255, 165, 0] as [number, number, number],    // Orange
    info: [13, 110, 253] as [number, number, number],      // Light blue
    text: [33, 37, 41] as [number, number, number],        // Dark grey
    muted: [108, 117, 125] as [number, number, number],    // Grey
    headerBg: [248, 249, 250] as [number, number, number], // Light grey
    white: [255, 255, 255] as [number, number, number],
  };

  // ── Helper: check page overflow and add new page if needed ──
  const ensureSpace = (needed: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── 1. Header ──
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setTextColor(...colors.white);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SplitSmart Import Report", margin, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    margin,
    23
  );

  y = 40;

  // ── 2. File Info ──
  doc.setTextColor(...colors.text);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Import Details", margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const details = [
    ["File", report.filename],
    ["Imported By", report.importedBy],
    [
      "Import Date",
      new Date(report.importedAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    ],
    ["Session ID", report.sessionId],
  ];

  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 35, y);
    y += 5;
  }

  y += 5;

  // ── 3. Summary Box ──
  ensureSpace(35);
  doc.setFillColor(...colors.headerBg);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, "F");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.text);
  doc.text("Summary", margin + 5, y + 7);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const colWidth = contentWidth / 4;
  const statsY = y + 14;

  // Total Rows
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(report.totalRows.toString(), margin + colWidth * 0.5, statsY, {
    align: "center",
  });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.muted);
  doc.text("Total Rows", margin + colWidth * 0.5, statsY + 5, {
    align: "center",
  });

  // Imported
  doc.setTextColor(...colors.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    report.importedRows.toString(),
    margin + colWidth * 1.5,
    statsY,
    { align: "center" }
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.muted);
  doc.text("Imported", margin + colWidth * 1.5, statsY + 5, {
    align: "center",
  });

  // Skipped
  doc.setTextColor(...colors.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    report.skippedRows.toString(),
    margin + colWidth * 2.5,
    statsY,
    { align: "center" }
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.muted);
  doc.text("Skipped", margin + colWidth * 2.5, statsY + 5, {
    align: "center",
  });

  // Anomalies
  doc.setTextColor(...colors.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    report.anomalies.total.toString(),
    margin + colWidth * 3.5,
    statsY,
    { align: "center" }
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.muted);
  doc.text("Anomalies", margin + colWidth * 3.5, statsY + 5, {
    align: "center",
  });

  y += 35;

  // ── 4. Anomaly Breakdown ──
  if (report.anomalies.total > 0) {
    ensureSpace(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Anomaly Breakdown", margin, y);
    y += 7;

    // Severity badges
    doc.setFontSize(9);
    const severities: Array<{
      label: string;
      count: number;
      color: [number, number, number];
    }> = [
      { label: "Errors", count: report.anomalies.bySeverity["ERROR"] ?? 0, color: colors.error },
      { label: "Warnings", count: report.anomalies.bySeverity["WARNING"] ?? 0, color: colors.warning },
      { label: "Info", count: report.anomalies.bySeverity["INFO"] ?? 0, color: colors.info },
    ];

    let badgeX = margin;
    for (const sev of severities) {
      if (sev.count === 0) continue;
      const text = `${sev.label}: ${sev.count}`;
      const textWidth = doc.getTextWidth(text) + 6;

      doc.setFillColor(...sev.color);
      doc.roundedRect(badgeX, y - 3.5, textWidth, 5.5, 1, 1, "F");
      doc.setTextColor(...colors.white);
      doc.setFont("helvetica", "bold");
      doc.text(text, badgeX + 3, y);
      badgeX += textWidth + 4;
    }

    y += 10;

    // ── 5. Anomaly Table ──
    ensureSpace(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Anomaly Details", margin, y);
    y += 7;

    // Table header
    const colWidths = {
      row: 12,
      severity: 20,
      type: 40,
      description: contentWidth - 12 - 20 - 40 - 25,
      resolution: 25,
    };

    doc.setFillColor(...colors.primary);
    doc.rect(margin, y - 4, contentWidth, 7, "F");
    doc.setTextColor(...colors.white);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");

    let headerX = margin + 2;
    doc.text("Row", headerX, y);
    headerX += colWidths.row;
    doc.text("Severity", headerX, y);
    headerX += colWidths.severity;
    doc.text("Type", headerX, y);
    headerX += colWidths.type;
    doc.text("Description", headerX, y);
    headerX += colWidths.description;
    doc.text("Status", headerX, y);

    y += 5;

    // Table rows
    doc.setFontSize(7);
    for (let i = 0; i < report.anomalies.details.length; i++) {
      const anomaly = report.anomalies.details[i];

      ensureSpace(8);

      // Alternating row background
      if (i % 2 === 0) {
        doc.setFillColor(...colors.headerBg);
        doc.rect(margin, y - 3.5, contentWidth, 6, "F");
      }

      let cellX = margin + 2;
      doc.setTextColor(...colors.text);
      doc.setFont("helvetica", "normal");

      // Row number
      doc.text(anomaly.rowNumber.toString(), cellX, y);
      cellX += colWidths.row;

      // Severity badge
      const sevColor = getSeverityColor(anomaly.severity, colors);
      doc.setTextColor(...sevColor);
      doc.setFont("helvetica", "bold");
      doc.text(anomaly.severity, cellX, y);
      cellX += colWidths.severity;

      // Type
      doc.setTextColor(...colors.text);
      doc.setFont("helvetica", "normal");
      const formattedType = formatAnomalyType(anomaly.type);
      doc.text(formattedType, cellX, y, {
        maxWidth: colWidths.type - 2,
      });
      cellX += colWidths.type;

      // Description (truncated to fit)
      const truncatedDesc = truncateText(
        doc,
        anomaly.description,
        colWidths.description - 2
      );
      doc.text(truncatedDesc, cellX, y);
      cellX += colWidths.description;

      // Resolution status
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...colors.muted);
      doc.text(anomaly.resolution, cellX, y);

      y += 6;
    }
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted);
    doc.setFont("helvetica", "normal");
    doc.text(
      `SplitSmart Import Report — Page ${p} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  return doc.output("arraybuffer");
}

// =============================================================================
// PDF Helpers
// =============================================================================

/**
 * Maps anomaly severity to a display colour for the PDF.
 */
function getSeverityColor(
  severity: string,
  colors: Record<string, [number, number, number]>
): [number, number, number] {
  switch (severity) {
    case "ERROR":
      return colors.error;
    case "WARNING":
      return colors.warning;
    case "INFO":
      return colors.info;
    default:
      return colors.text;
  }
}

/**
 * Formats an anomaly type enum value for display.
 * E.g., "DUPLICATE_EXPENSE" → "Duplicate Expense"
 */
function formatAnomalyType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Truncates text to fit within a given width, adding "…" if truncated.
 */
function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 0 && doc.getTextWidth(truncated + "…") > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return truncated + "…";
}

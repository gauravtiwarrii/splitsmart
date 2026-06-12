// =============================================================================
// Import Report API — Generate PDF/JSON reports for import sessions
// =============================================================================
// GET /api/import/report?sessionId=xxx&format=json|pdf
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateJSONReport, generatePDFReport } from "@/lib/report-generator";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const format = searchParams.get("format") || "json";

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Generate JSON report data
    const report = await generateJSONReport(sessionId);

    if (format === "pdf") {
      // Generate PDF
      const pdfBuffer = generatePDFReport(report);
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="import-report-${sessionId}.pdf"`,
        },
      });
    }

    // Return JSON report
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

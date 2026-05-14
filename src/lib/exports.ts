import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Papa from "papaparse";

export async function exportDashboardPdf(elementId: string, countryName: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#071111" });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const width = pdf.internal.pageSize.getWidth();
  const height = (canvas.height * width) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, width, Math.min(height, 290));
  pdf.save(`greenfair-${countryName.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

export function exportRowsXlsx(rows: Record<string, unknown>[], countryName: string) {
  const headers = Object.keys(rows[0] ?? {});
  const escapeXml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const xmlRows = [
    headers.map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`).join(""),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const type = typeof value === "number" ? "Number" : "String";
          return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
        })
        .join("")
    )
  ]
    .map((cells) => `<Row>${cells}</Row>`)
    .join("");
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="GreenFair"><Table>${xmlRows}</Table></Worksheet>
</Workbook>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `greenfair-${countryName.toLowerCase().replace(/\s+/g, "-")}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportRowsCsv(rows: Record<string, unknown>[], countryName: string) {
  const blob = new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `greenfair-${countryName.toLowerCase().replace(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

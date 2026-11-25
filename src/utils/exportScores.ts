import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompletedMatch } from '../data/tournamentData';
import { sortCompletedMatches } from './completedMatches';

export type ScoreExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

const EXPORT_COLUMNS = [
  'fixtureId',
  'category',
  'stage',
  'details',
  'scheduledDate',
  'scheduledTime',
  'player1',
  'player2',
  'teamA',
  'teamB',
  'score1',
  'score2',
  'result',
  'winnerName',
  'winnerSide',
  'maxPoints',
  'isTrump',
  'completedDate',
  'completedTime',
  'completedAt'
] as const;

type ExportColumn = (typeof EXPORT_COLUMNS)[number];

const LOGO_PATH = '/nature-walk-logo-1.png';

function assertRows(rows: CompletedMatch[]): CompletedMatch[] {
  if (!Array.isArray(rows)) {
    throw new Error('exportScores: rows must be an array');
  }
  return sortCompletedMatches(rows.filter((r) => r && r.status === 'completed'));
}

function cellValue(row: CompletedMatch, key: ExportColumn): string | number | boolean {
  const value = row[key];
  if (value === null || value === undefined) return '';
  return value as string | number | boolean;
}

function escapeCsv(value: string | number | boolean): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function downloadBlob(filename: string, mime: string, contents: string | Blob): void {
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new Error('downloadBlob: filename is required');
  }
  if (typeof document === 'undefined') {
    throw new Error('downloadBlob: browser document is required');
  }

  const blob =
    contents instanceof Blob
      ? contents
      : new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.trim();
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toScoresCsv(rows: CompletedMatch[]): string {
  const data = assertRows(rows);
  const header = EXPORT_COLUMNS.join(',');
  const lines = data.map((row) =>
    EXPORT_COLUMNS.map((col) => escapeCsv(cellValue(row, col))).join(',')
  );
  return `\uFEFF${[header, ...lines].join('\n')}`;
}

export function toScoresJson(rows: CompletedMatch[]): string {
  const data = assertRows(rows);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: data.length,
      matches: data
    },
    null,
    2
  );
}

/** Excel-compatible SpreadsheetML (.xls). */
export function toScoresExcelXml(rows: CompletedMatch[]): string {
  const data = assertRows(rows);
  const headerCells = EXPORT_COLUMNS.map(
    (col) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col)}</Data></Cell>`
  ).join('');

  const bodyRows = data
    .map((row) => {
      const cells = EXPORT_COLUMNS.map((col) => {
        const value = cellValue(row, col);
        if (typeof value === 'number' && Number.isFinite(value)) {
          return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
        }
        if (typeof value === 'boolean') {
          return `<Cell><Data ss:Type="String">${value ? 'true' : 'false'}</Data></Cell>`;
        }
        return `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="Completed Matches">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

async function loadLogoDataUrl(): Promise<string | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(LOGO_PATH);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read logo'));
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Failed to load PDF logo:', err);
    return null;
  }
}

/**
 * Build and download a landscape A4 PDF of completed matches.
 * Pure aside from browser fetch/save; no shared mutable state.
 */
export async function downloadScoresPdf(rows: CompletedMatch[]): Promise<void> {
  const data = assertRows(rows);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logo = await loadLogoDataUrl();
  const exportedAt = new Date().toLocaleString();

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 26, pageW, 1.2, 'F');

  if (logo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(9, 3, 20, 20, 1.5, 1.5, 'F');
      doc.addImage(logo, 'PNG', 10, 4, 18, 18);
    } catch (err) {
      console.error('Failed to embed logo in PDF:', err);
    }
  }

  const textX = logo ? 32 : 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(251, 191, 36);
  doc.text('NPL 2026', textX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Completed Match Results', textX, 19);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${data.length} match${data.length === 1 ? '' : 'es'}  ·  Exported ${exportedAt}`,
    pageW - 12,
    15,
    { align: 'right' }
  );

  autoTable(doc, {
    startY: 32,
    head: [['#', 'Completed', 'Scheduled', 'Category', 'Match', 'Result', 'Winner']],
    body: data.map((row, index) => [
      String(index + 1),
      `${row.completedDate || ''} ${row.completedTime || ''}`.trim(),
      `${row.scheduledDate || ''} ${row.scheduledTime || ''}`.trim(),
      row.category || '',
      row.details || '',
      row.result || '',
      `${row.winnerName || ''}${row.isTrump ? ' ★' : ''}`
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.4,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [251, 191, 36],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 30 },
      3: { cellWidth: 38 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 22, fontStyle: 'bold', textColor: [180, 83, 9] },
      6: { cellWidth: 36, textColor: [5, 150, 105], fontStyle: 'bold' }
    },
    margin: { left: 10, right: 10, bottom: 16 },
    didDrawPage: (hookData) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `NPL 2026 · Renaissance  ·  Page ${hookData.pageNumber} of ${pageCount}`,
        pageW / 2,
        pageH - 6,
        { align: 'center' }
      );
    }
  });

  doc.save(`npl-2026-scores-${stamp()}.pdf`);
}

/**
 * Exports completed match scores.
 * PDF downloads a styled .pdf file; other formats download immediately.
 * Concurrency: pure transform + one-shot browser download; no shared mutable state.
 */
export async function exportScores(
  rows: CompletedMatch[],
  format: ScoreExportFormat
): Promise<void> {
  if (!['csv', 'json', 'excel', 'pdf'].includes(format)) {
    throw new Error(`exportScores: unsupported format "${String(format)}"`);
  }

  const data = assertRows(rows);
  const base = `npl-2026-scores-${stamp()}`;

  if (format === 'csv') {
    downloadBlob(`${base}.csv`, 'text/csv;charset=utf-8', toScoresCsv(data));
    return;
  }

  if (format === 'json') {
    downloadBlob(`${base}.json`, 'application/json;charset=utf-8', toScoresJson(data));
    return;
  }

  if (format === 'excel') {
    downloadBlob(
      `${base}.xls`,
      'application/vnd.ms-excel;charset=utf-8',
      toScoresExcelXml(data)
    );
    return;
  }

  await downloadScoresPdf(data);
}

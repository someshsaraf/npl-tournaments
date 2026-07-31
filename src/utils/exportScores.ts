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

function buildPdfPrintHtml(rows: CompletedMatch[]): string {
  const data = assertRows(rows);
  const tableRows = data
    .map(
      (row) => `<tr>
      <td>${escapeXml(`${row.completedDate} ${row.completedTime}`)}</td>
      <td>${escapeXml(`${row.scheduledDate} ${row.scheduledTime}`)}</td>
      <td>${escapeXml(row.category || '')}</td>
      <td>${escapeXml(row.details || '')}</td>
      <td>${escapeXml(row.result || '')}</td>
      <td>${escapeXml(row.winnerName || '')}${row.isTrump ? ' ★' : ''}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NPL 2026 Completed Matches</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p { font-size: 12px; color: #444; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; }
    @media print {
      body { margin: 12px; }
      a { display: none; }
    }
  </style>
</head>
<body>
  <h1>NPL 2026 — Completed Matches</h1>
  <p>Exported ${escapeXml(new Date().toLocaleString())} · ${data.length} match${data.length === 1 ? '' : 'es'}</p>
  <table>
    <thead>
      <tr>
        <th>Completed</th>
        <th>Scheduled</th>
        <th>Category</th>
        <th>Match</th>
        <th>Result</th>
        <th>Winner</th>
      </tr>
    </thead>
    <tbody>${tableRows || '<tr><td colspan="6">No completed matches</td></tr>'}</tbody>
  </table>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;
}

/**
 * Exports completed match scores.
 * PDF opens a print dialog (Save as PDF). Other formats download a file.
 * Concurrency: pure transform + one-shot DOM download/print; no shared mutable state.
 */
export function exportScores(rows: CompletedMatch[], format: ScoreExportFormat): void {
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

  // PDF via browser print → Save as PDF
  const html = buildPdfPrintHtml(data);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
  if (!printWindow) {
    throw new Error('exportScores: pop-up blocked — allow pop-ups to export PDF');
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

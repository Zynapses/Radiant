// RADIANT v4.18.55 - Excel/CSV Data Extraction Converter
// Uses xlsx library for Excel files and native parsing for CSV

import * as XLSX from 'xlsx';

export interface ExcelExtractionResult {
  success: boolean;
  data: SheetData[];
  text: string;          // Flattened text representation
  json: string;          // JSON representation
  metadata: {
    sheetCount: number;
    totalRows: number;
    totalColumns: number;
    sheetNames: string[];
    hasFormulas: boolean;
  };
  error?: string;
}

export interface SheetData {
  name: string;
  rows: Record<string, unknown>[];
  headers: string[];
  rowCount: number;
  columnCount: number;
}

export interface ExcelExtractionOptions {
  outputFormat?: 'json' | 'csv' | 'markdown' | 'text';
  includeHeaders?: boolean;       // Include column headers (default: true)
  maxRows?: number;               // Limit rows per sheet (default: 10000)
  maxSheets?: number;             // Limit sheets to process (default: all)
  sheetsToInclude?: string[];     // Specific sheet names to include
  dateFormat?: string;            // Date formatting (default: ISO)
  emptyValue?: string;            // Value for empty cells (default: '')
}

/**
 * Extract data from an Excel file (XLSX/XLS)
 * 
 * @param excelBuffer - The Excel file as a Buffer
 * @param options - Extraction options
 * @returns Extraction result with data and metadata
 */
export async function extractExcelData(
  excelBuffer: Buffer,
  options: ExcelExtractionOptions = {}
): Promise<ExcelExtractionResult> {
  const {
    outputFormat = 'json',
    includeHeaders = true,
    maxRows = 10000,
    maxSheets,
    sheetsToInclude,
    dateFormat = 'ISO',
    emptyValue = '',
  } = options;

  try {
    // Parse workbook
    const workbook = XLSX.read(excelBuffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellStyles: false,  // Skip styles for performance
    });

    const sheetNames = workbook.SheetNames;
    const sheetsToProcess = sheetsToInclude 
      ? sheetNames.filter(name => sheetsToInclude.includes(name))
      : maxSheets 
        ? sheetNames.slice(0, maxSheets)
        : sheetNames;

    const allSheetData: SheetData[] = [];
    let totalRows = 0;
    let totalColumns = 0;
    let hasFormulas = false;

    for (const sheetName of sheetsToProcess) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // Check for formulas
      const sheetJson = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        dateNF: dateFormat === 'ISO' ? 'yyyy-mm-dd' : dateFormat,
        defval: emptyValue,
      }) as unknown[][];

      // Limit rows
      const limitedRows = sheetJson.slice(0, maxRows + (includeHeaders ? 1 : 0));

      // Extract headers and data
      const headers = includeHeaders && limitedRows.length > 0
        ? (limitedRows[0] as string[]).map(h => String(h || `Column_${limitedRows[0].indexOf(h)}`))
        : [];
      
      const dataRows = includeHeaders ? limitedRows.slice(1) : limitedRows;

      // Convert to objects
      const rows: Record<string, unknown>[] = dataRows.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        (row as unknown[]).forEach((cell, index) => {
          const key = headers[index] || `col_${index}`;
          obj[key] = cell;
        });
        return obj;
      });

      const columnCount = headers.length || (limitedRows[0]?.length || 0);
      
      allSheetData.push({
        name: sheetName,
        rows,
        headers,
        rowCount: rows.length,
        columnCount,
      });

      totalRows += rows.length;
      totalColumns = Math.max(totalColumns, columnCount);

      // Check for formulas in sheet
      for (const cellRef in sheet) {
        if (cellRef[0] !== '!' && sheet[cellRef]?.f) {
          hasFormulas = true;
          break;
        }
      }
    }

    // Format output
    let text: string;
    let json: string;

    switch (outputFormat) {
      case 'csv':
        text = allSheetData.map(sheet => 
          formatSheetAsCsv(sheet)
        ).join('\n\n--- Next Sheet ---\n\n');
        json = JSON.stringify(allSheetData, null, 2);
        break;

      case 'markdown':
        text = allSheetData.map(sheet => 
          formatSheetAsMarkdown(sheet)
        ).join('\n\n---\n\n');
        json = JSON.stringify(allSheetData, null, 2);
        break;

      case 'text':
        text = allSheetData.map(sheet => 
          formatSheetAsText(sheet)
        ).join('\n\n--- Next Sheet ---\n\n');
        json = JSON.stringify(allSheetData, null, 2);
        break;

      case 'json':
      default:
        json = JSON.stringify(allSheetData, null, 2);
        text = json;
        break;
    }

    return {
      success: true,
      data: allSheetData,
      text,
      json,
      metadata: {
        sheetCount: allSheetData.length,
        totalRows,
        totalColumns,
        sheetNames: allSheetData.map(s => s.name),
        hasFormulas,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Excel parsing error';

    return {
      success: false,
      data: [],
      text: '',
      json: '[]',
      metadata: {
        sheetCount: 0,
        totalRows: 0,
        totalColumns: 0,
        sheetNames: [],
        hasFormulas: false,
      },
      error: `Excel extraction failed: ${errorMessage}`,
    };
  }
}

/**
 * Parse CSV content directly
 */
export function parseCsv(
  csvContent: string,
  options: { delimiter?: string; hasHeaders?: boolean } = {}
): SheetData {
  const { delimiter = ',', hasHeaders = true } = options;

  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  const rows: Record<string, unknown>[] = [];
  
  // Parse header
  const headerLine = hasHeaders ? lines[0] : '';
  const headers = headerLine ? parseCSVLine(headerLine, delimiter) : [];
  
  // Parse data rows
  const dataLines = hasHeaders ? lines.slice(1) : lines;
  
  for (const line of dataLines) {
    const values = parseCSVLine(line, delimiter);
    const obj: Record<string, unknown> = {};
    
    values.forEach((value, index) => {
      const key = headers[index] || `col_${index}`;
      obj[key] = value;
    });
    
    rows.push(obj);
  }

  return {
    name: 'CSV',
    rows,
    headers,
    rowCount: rows.length,
    columnCount: headers.length || (rows[0] ? Object.keys(rows[0]).length : 0),
  };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Format sheet data as CSV
 */
function formatSheetAsCsv(sheet: SheetData): string {
  const lines: string[] = [];
  
  // Header
  if (sheet.headers.length > 0) {
    lines.push(sheet.headers.map(h => escapeCsvValue(h)).join(','));
  }
  
  // Data
  for (const row of sheet.rows) {
    const values = sheet.headers.map(h => escapeCsvValue(String(row[h] ?? '')));
    lines.push(values.join(','));
  }
  
  return `Sheet: ${sheet.name}\n${lines.join('\n')}`;
}

/**
 * Format sheet data as Markdown table
 */
function formatSheetAsMarkdown(sheet: SheetData): string {
  if (sheet.rows.length === 0) {
    return `## ${sheet.name}\n\n*Empty sheet*`;
  }

  const lines: string[] = [`## ${sheet.name}\n`];
  
  // Header
  if (sheet.headers.length > 0) {
    lines.push(`| ${sheet.headers.join(' | ')} |`);
    lines.push(`| ${sheet.headers.map(() => '---').join(' | ')} |`);
  }
  
  // Data (limit to first 100 rows for readability)
  const displayRows = sheet.rows.slice(0, 100);
  for (const row of displayRows) {
    const values = sheet.headers.map(h => String(row[h] ?? '').replace(/\|/g, '\\|'));
    lines.push(`| ${values.join(' | ')} |`);
  }
  
  if (sheet.rows.length > 100) {
    lines.push(`\n*...and ${sheet.rows.length - 100} more rows*`);
  }
  
  return lines.join('\n');
}

/**
 * Format sheet data as plain text
 */
function formatSheetAsText(sheet: SheetData): string {
  if (sheet.rows.length === 0) {
    return `Sheet: ${sheet.name}\n(Empty)`;
  }

  const lines: string[] = [`Sheet: ${sheet.name}`];
  
  // Column widths for alignment
  const widths: number[] = sheet.headers.map((h, i) => {
    const maxDataWidth = Math.max(
      ...sheet.rows.slice(0, 100).map(row => String(row[h] ?? '').length)
    );
    return Math.max(h.length, maxDataWidth, 5);
  });
  
  // Header
  if (sheet.headers.length > 0) {
    lines.push(sheet.headers.map((h, i) => h.padEnd(widths[i])).join(' | '));
    lines.push(widths.map(w => '-'.repeat(w)).join('-+-'));
  }
  
  // Data
  for (const row of sheet.rows.slice(0, 100)) {
    const values = sheet.headers.map((h, i) => 
      String(row[h] ?? '').padEnd(widths[i])
    );
    lines.push(values.join(' | '));
  }
  
  if (sheet.rows.length > 100) {
    lines.push(`... ${sheet.rows.length - 100} more rows`);
  }
  
  return lines.join('\n');
}

/**
 * Escape a value for CSV output
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Check if a buffer is an Excel file (XLSX or XLS)
 */
export function isExcelBuffer(buffer: Buffer): boolean {
  // XLSX (ZIP format): starts with PK
  const isXlsx = buffer[0] === 0x50 && buffer[1] === 0x4B;
  // XLS (OLE format): starts with D0 CF 11 E0
  const isXls = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
  return isXlsx || isXls;
}

/**
 * Estimate token count for extracted data
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Report Export Utilities
 * Version: 5.42.0
 * 
 * Generates PDF, Excel, and HTML exports for AI reports with brand kit support.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');

// Types
interface BrandKit {
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerFont: string;
  companyName: string;
  tagline: string;
}

interface ReportSection {
  id: string;
  type: 'heading' | 'paragraph' | 'metrics' | 'chart' | 'table' | 'quote' | 'list';
  content: string;
  level?: 1 | 2 | 3;
  items?: string[];
  metrics?: { label: string; value: string; change?: string; trend?: 'up' | 'down' | 'neutral' }[];
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: { label: string; value: number }[];
}

interface TableConfig {
  title: string;
  headers: string[];
  rows: string[][];
}

interface SmartInsight {
  type: 'anomaly' | 'trend' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  description: string;
  metric?: string;
  value?: string;
  change?: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface GeneratedReport {
  title: string;
  subtitle?: string;
  executive_summary?: string;
  sections: ReportSection[];
  charts?: ChartConfig[];
  tables?: TableConfig[];
  smart_insights?: SmartInsight[];
  created_at: string;
  data_range_start?: string;
  data_range_end?: string;
  confidence_score?: number;
}

// =====================================================
// PDF EXPORT
// =====================================================

export async function generatePdfReport(
  report: GeneratedReport,
  brandKit: BrandKit | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: report.title,
          Author: brandKit?.companyName || 'RADIANT',
          Subject: 'AI Generated Report',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primaryColor = brandKit?.primaryColor || '#3b82f6';
      const secondaryColor = brandKit?.secondaryColor || '#64748b';

      // Header with branding
      if (brandKit?.companyName) {
        doc.fontSize(10).fillColor(secondaryColor).text(brandKit.companyName, { align: 'right' });
        if (brandKit.tagline) {
          doc.fontSize(8).text(brandKit.tagline, { align: 'right' });
        }
        doc.moveDown(2);
      }

      // Title
      doc.fontSize(24).fillColor(primaryColor).text(report.title, { align: 'center' });
      if (report.subtitle) {
        doc.fontSize(14).fillColor(secondaryColor).text(report.subtitle, { align: 'center' });
      }
      doc.moveDown();

      // Date range
      if (report.data_range_start && report.data_range_end) {
        doc.fontSize(10).fillColor(secondaryColor)
          .text(`Data Range: ${formatDate(report.data_range_start)} - ${formatDate(report.data_range_end)}`, { align: 'center' });
      }
      doc.moveDown(2);

      // Horizontal line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primaryColor).stroke();
      doc.moveDown();

      // Executive Summary
      if (report.executive_summary) {
        doc.fontSize(14).fillColor(primaryColor).text('Executive Summary');
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#333333').text(report.executive_summary, { align: 'justify' });
        doc.moveDown(1.5);
      }

      // Sections
      for (const section of report.sections || []) {
        renderPdfSection(doc, section, primaryColor, secondaryColor);
      }

      // Smart Insights
      if (report.smart_insights && report.smart_insights.length > 0) {
        doc.addPage();
        doc.fontSize(16).fillColor(primaryColor).text('AI-Powered Insights');
        doc.moveDown();

        for (const insight of report.smart_insights) {
          const insightColor = getInsightColor(insight.type);
          doc.fontSize(12).fillColor(insightColor).text(`● ${insight.title}`);
          doc.fontSize(10).fillColor('#333333').text(insight.description);
          if (insight.metric && insight.value) {
            doc.fontSize(10).fillColor(secondaryColor)
              .text(`${insight.metric}: ${insight.value}${insight.change ? ` (${insight.change})` : ''}`);
          }
          doc.fontSize(8).fillColor(secondaryColor)
            .text(`Severity: ${insight.severity} | Confidence: ${(insight.confidence * 100).toFixed(0)}%`);
          doc.moveDown();
        }
      }

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor(secondaryColor)
          .text(
            `Generated on ${formatDate(report.created_at)} | Page ${i + 1} of ${pageCount}`,
            50, 780, { align: 'center', width: 495 }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function renderPdfSection(
  doc: typeof PDFDocument,
  section: ReportSection,
  primaryColor: string,
  secondaryColor: string
): void {
  switch (section.type) {
    case 'heading':
      const fontSize = section.level === 1 ? 16 : section.level === 2 ? 14 : 12;
      doc.fontSize(fontSize).fillColor(primaryColor).text(section.content);
      doc.moveDown(0.5);
      break;

    case 'paragraph':
      doc.fontSize(11).fillColor('#333333').text(section.content, { align: 'justify' });
      doc.moveDown();
      break;

    case 'list':
      for (const item of section.items || []) {
        doc.fontSize(11).fillColor('#333333').text(`• ${item}`);
      }
      doc.moveDown();
      break;

    case 'quote':
      doc.fontSize(11).fillColor(secondaryColor).text(`"${section.content}"`, {
        indent: 20,
        align: 'left',
      });
      doc.moveDown();
      break;

    case 'metrics':
      if (section.metrics) {
        const startX = 50;
        const cardWidth = 120;
        let x = startX;
        
        for (const metric of section.metrics) {
          if (x + cardWidth > 545) {
            x = startX;
            doc.moveDown(3);
          }
          
          doc.fontSize(9).fillColor(secondaryColor).text(metric.label, x, doc.y);
          doc.fontSize(16).fillColor(primaryColor).text(metric.value, x, doc.y + 12);
          if (metric.change) {
            const changeColor = metric.trend === 'up' ? '#10b981' : metric.trend === 'down' ? '#ef4444' : secondaryColor;
            doc.fontSize(10).fillColor(changeColor).text(metric.change, x, doc.y + 30);
          }
          x += cardWidth;
        }
        doc.moveDown(4);
      }
      break;

    case 'chart':
      // Charts are rendered as text descriptions in PDF
      doc.fontSize(11).fillColor(secondaryColor).text(`[Chart: ${section.content}]`);
      doc.moveDown();
      break;

    case 'table':
      // Tables need manual rendering in PDFKit
      doc.fontSize(11).fillColor(secondaryColor).text(`[Table section - see Excel export for full data]`);
      doc.moveDown();
      break;
  }
}

// =====================================================
// EXCEL EXPORT
// =====================================================

export async function generateExcelReport(report: GeneratedReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RADIANT AI Reports';
  workbook.created = new Date();

  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Property', key: 'property', width: 20 },
    { header: 'Value', key: 'value', width: 60 },
  ];

  summarySheet.addRow({ property: 'Title', value: report.title });
  summarySheet.addRow({ property: 'Subtitle', value: report.subtitle || '' });
  summarySheet.addRow({ property: 'Generated', value: formatDate(report.created_at) });
  summarySheet.addRow({ property: 'Data Range', value: report.data_range_start && report.data_range_end 
    ? `${formatDate(report.data_range_start)} - ${formatDate(report.data_range_end)}` : 'N/A' });
  summarySheet.addRow({ property: 'Confidence', value: report.confidence_score 
    ? `${(report.confidence_score * 100).toFixed(0)}%` : 'N/A' });
  summarySheet.addRow({ property: '', value: '' });
  summarySheet.addRow({ property: 'Executive Summary', value: report.executive_summary || '' });

  // Style header row
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' },
  };
  summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Metrics Sheet (if any)
  const metricsSection = (report.sections || []).find(s => s.type === 'metrics');
  if (metricsSection?.metrics) {
    const metricsSheet = workbook.addWorksheet('Metrics');
    metricsSheet.columns = [
      { header: 'Metric', key: 'label', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
      { header: 'Change', key: 'change', width: 15 },
      { header: 'Trend', key: 'trend', width: 15 },
    ];

    for (const metric of metricsSection.metrics) {
      metricsSheet.addRow({
        label: metric.label,
        value: metric.value,
        change: metric.change || '',
        trend: metric.trend || '',
      });
    }

    metricsSheet.getRow(1).font = { bold: true };
    metricsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    metricsSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  }

  // Charts Data Sheets
  for (let i = 0; i < (report.charts || []).length; i++) {
    const chart = report.charts![i];
    const chartSheet = workbook.addWorksheet(`Chart ${i + 1} - ${chart.title.substring(0, 20)}`);
    
    chartSheet.columns = [
      { header: 'Label', key: 'label', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    for (const dataPoint of chart.data) {
      chartSheet.addRow({ label: dataPoint.label, value: dataPoint.value });
    }

    chartSheet.getRow(1).font = { bold: true };
    chartSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    chartSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  }

  // Tables Sheets
  for (let i = 0; i < (report.tables || []).length; i++) {
    const table = report.tables![i];
    const tableSheet = workbook.addWorksheet(`Table ${i + 1} - ${table.title.substring(0, 20)}`);
    
    tableSheet.columns = table.headers.map((header, idx) => ({
      header,
      key: `col${idx}`,
      width: 20,
    }));

    for (const row of table.rows) {
      const rowData: Record<string, string> = {};
      row.forEach((cell, idx) => {
        rowData[`col${idx}`] = cell;
      });
      tableSheet.addRow(rowData);
    }

    tableSheet.getRow(1).font = { bold: true };
    tableSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    tableSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  }

  // Insights Sheet
  if (report.smart_insights && report.smart_insights.length > 0) {
    const insightsSheet = workbook.addWorksheet('Smart Insights');
    insightsSheet.columns = [
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Metric', key: 'metric', width: 20 },
      { header: 'Value', key: 'value', width: 15 },
      { header: 'Change', key: 'change', width: 10 },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Confidence', key: 'confidence', width: 12 },
    ];

    for (const insight of report.smart_insights) {
      insightsSheet.addRow({
        type: insight.type,
        title: insight.title,
        description: insight.description,
        metric: insight.metric || '',
        value: insight.value || '',
        change: insight.change || '',
        severity: insight.severity,
        confidence: `${(insight.confidence * 100).toFixed(0)}%`,
      });
    }

    insightsSheet.getRow(1).font = { bold: true };
    insightsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    insightsSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// =====================================================
// HTML EXPORT
// =====================================================

export async function generateHtmlReport(
  report: GeneratedReport,
  brandKit: BrandKit | null
): Promise<string> {
  const primaryColor = brandKit?.primaryColor || '#3b82f6';
  const secondaryColor = brandKit?.secondaryColor || '#64748b';
  const accentColor = brandKit?.accentColor || '#10b981';
  const fontFamily = brandKit?.fontFamily || 'Inter, system-ui, sans-serif';
  const headerFont = brandKit?.headerFont || fontFamily;

  const sectionsHtml = (report.sections || []).map(section => renderHtmlSection(section, primaryColor, secondaryColor)).join('\n');
  
  const insightsHtml = report.smart_insights && report.smart_insights.length > 0 
    ? `<section class="insights">
        <h2>AI-Powered Insights</h2>
        <div class="insights-grid">
          ${report.smart_insights.map(insight => `
            <div class="insight-card insight-${insight.type}">
              <div class="insight-header">
                <span class="insight-icon">${getInsightIcon(insight.type)}</span>
                <span class="insight-title">${escapeHtml(insight.title)}</span>
                <span class="insight-severity severity-${insight.severity}">${insight.severity}</span>
              </div>
              <p class="insight-description">${escapeHtml(insight.description)}</p>
              ${insight.metric && insight.value ? `
                <div class="insight-metric">
                  <span class="metric-name">${escapeHtml(insight.metric)}:</span>
                  <span class="metric-value">${escapeHtml(insight.value)}</span>
                  ${insight.change ? `<span class="metric-change">${escapeHtml(insight.change)}</span>` : ''}
                </div>
              ` : ''}
              <div class="insight-confidence">Confidence: ${(insight.confidence * 100).toFixed(0)}%</div>
            </div>
          `).join('\n')}
        </div>
      </section>`
    : '';

  const chartsHtml = report.charts && report.charts.length > 0
    ? `<section class="charts">
        <h2>Data Visualizations</h2>
        ${report.charts.map(chart => `
          <div class="chart-container">
            <h3>${escapeHtml(chart.title)}</h3>
            <div class="chart-data">
              <table>
                <thead><tr><th>Label</th><th>Value</th></tr></thead>
                <tbody>
                  ${chart.data.map(d => `<tr><td>${escapeHtml(d.label)}</td><td>${d.value.toLocaleString()}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('\n')}
      </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.title)}</title>
  <style>
    :root {
      --primary: ${primaryColor};
      --secondary: ${secondaryColor};
      --accent: ${accentColor};
      --font-family: ${fontFamily};
      --header-font: ${headerFont};
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--font-family);
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f8fafc;
    }
    
    header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid var(--primary);
    }
    
    .brand {
      color: var(--secondary);
      font-size: 14px;
      margin-bottom: 10px;
    }
    
    h1 {
      font-family: var(--header-font);
      color: var(--primary);
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    
    .subtitle {
      color: var(--secondary);
      font-size: 1.2rem;
    }
    
    .meta {
      color: var(--secondary);
      font-size: 0.9rem;
      margin-top: 15px;
    }
    
    .executive-summary {
      background: white;
      padding: 25px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid var(--primary);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .executive-summary h2 {
      color: var(--primary);
      margin-bottom: 15px;
    }
    
    section {
      background: white;
      padding: 25px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h2 {
      font-family: var(--header-font);
      color: var(--primary);
      font-size: 1.5rem;
      margin-bottom: 15px;
    }
    
    h3 {
      font-family: var(--header-font);
      color: var(--primary);
      font-size: 1.2rem;
      margin: 20px 0 10px;
    }
    
    p { margin-bottom: 15px; }
    
    ul {
      margin-left: 20px;
      margin-bottom: 15px;
    }
    
    li { margin-bottom: 8px; }
    
    blockquote {
      border-left: 4px solid var(--accent);
      padding-left: 20px;
      color: var(--secondary);
      font-style: italic;
      margin: 15px 0;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    
    .metric-card {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    
    .metric-label {
      color: var(--secondary);
      font-size: 0.85rem;
      margin-bottom: 5px;
    }
    
    .metric-value {
      color: var(--primary);
      font-size: 1.8rem;
      font-weight: bold;
    }
    
    .metric-change {
      font-size: 0.9rem;
      margin-top: 5px;
    }
    
    .metric-change.up { color: var(--accent); }
    .metric-change.down { color: #ef4444; }
    
    .insights-grid {
      display: grid;
      gap: 15px;
    }
    
    .insight-card {
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid;
    }
    
    .insight-trend { border-color: #3b82f6; background: #eff6ff; }
    .insight-anomaly { border-color: #f59e0b; background: #fffbeb; }
    .insight-achievement { border-color: #10b981; background: #ecfdf5; }
    .insight-recommendation { border-color: #8b5cf6; background: #f5f3ff; }
    .insight-warning { border-color: #ef4444; background: #fef2f2; }
    
    .insight-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .insight-title {
      font-weight: 600;
      flex: 1;
    }
    
    .insight-severity {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .severity-low { background: #dcfce7; color: #166534; }
    .severity-medium { background: #fef3c7; color: #92400e; }
    .severity-high { background: #fee2e2; color: #991b1b; }
    
    .insight-description {
      color: #4b5563;
      margin-bottom: 10px;
    }
    
    .insight-metric {
      font-size: 0.9rem;
      color: var(--secondary);
    }
    
    .insight-confidence {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 10px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    
    th {
      background: var(--primary);
      color: white;
    }
    
    tr:hover { background: #f8fafc; }
    
    footer {
      text-align: center;
      color: var(--secondary);
      font-size: 0.85rem;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    
    @media print {
      body { background: white; }
      section { box-shadow: none; border: 1px solid #e2e8f0; }
    }
  </style>
</head>
<body>
  <header>
    ${brandKit?.companyName ? `<div class="brand">${escapeHtml(brandKit.companyName)}${brandKit.tagline ? ` | ${escapeHtml(brandKit.tagline)}` : ''}</div>` : ''}
    <h1>${escapeHtml(report.title)}</h1>
    ${report.subtitle ? `<p class="subtitle">${escapeHtml(report.subtitle)}</p>` : ''}
    <p class="meta">
      Generated on ${formatDate(report.created_at)}
      ${report.data_range_start && report.data_range_end ? ` | Data: ${formatDate(report.data_range_start)} - ${formatDate(report.data_range_end)}` : ''}
      ${report.confidence_score ? ` | Confidence: ${(report.confidence_score * 100).toFixed(0)}%` : ''}
    </p>
  </header>
  
  ${report.executive_summary ? `
  <div class="executive-summary">
    <h2>Executive Summary</h2>
    <p>${escapeHtml(report.executive_summary)}</p>
  </div>
  ` : ''}
  
  <main>
    ${sectionsHtml}
  </main>
  
  ${insightsHtml}
  ${chartsHtml}
  
  <footer>
    <p>Generated by RADIANT AI Report Writer v5.42.0</p>
  </footer>
</body>
</html>`;
}

function renderHtmlSection(section: ReportSection, primaryColor: string, _secondaryColor: string): string {
  switch (section.type) {
    case 'heading':
      const tag = section.level === 1 ? 'h2' : section.level === 2 ? 'h3' : 'h4';
      return `<${tag}>${escapeHtml(section.content)}</${tag}>`;

    case 'paragraph':
      return `<p>${escapeHtml(section.content)}</p>`;

    case 'list':
      return `<ul>${(section.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;

    case 'quote':
      return `<blockquote>${escapeHtml(section.content)}</blockquote>`;

    case 'metrics':
      if (!section.metrics) return '';
      return `<div class="metrics-grid">
        ${section.metrics.map(m => `
          <div class="metric-card">
            <div class="metric-label">${escapeHtml(m.label)}</div>
            <div class="metric-value">${escapeHtml(m.value)}</div>
            ${m.change ? `<div class="metric-change ${m.trend || ''}">${escapeHtml(m.change)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;

    case 'chart':
      return `<div class="chart-placeholder" style="background:#f1f5f9;padding:40px;text-align:center;border-radius:8px;color:${primaryColor}">
        <p>📊 ${escapeHtml(section.content)}</p>
        <p style="font-size:0.85rem;color:#64748b">Chart data available in JSON/Excel export</p>
      </div>`;

    case 'table':
      return `<div class="table-placeholder" style="background:#f1f5f9;padding:20px;border-radius:8px;color:#64748b">
        <p>📋 Table data available in Excel export</p>
      </div>`;

    default:
      return '';
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInsightColor(type: string): string {
  const colors: Record<string, string> = {
    trend: '#3b82f6',
    anomaly: '#f59e0b',
    achievement: '#10b981',
    recommendation: '#8b5cf6',
    warning: '#ef4444',
  };
  return colors[type] || '#64748b';
}

function getInsightIcon(type: string): string {
  const icons: Record<string, string> = {
    trend: '📈',
    anomaly: '⚠️',
    achievement: '🎯',
    recommendation: '💡',
    warning: '🚨',
  };
  return icons[type] || '📊';
}

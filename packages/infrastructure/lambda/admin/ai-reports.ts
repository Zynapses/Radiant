/**
 * RADIANT v5.42.0 - AI Reports Admin API
 * 
 * Endpoints for AI-powered report generation, templates, brand kits, and smart insights.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';
import { generatePdfReport, generateExcelReport, generateHtmlReport, GeneratedReport } from '../shared/report-exporters';
import { uploadToS3, getSignedUrl } from '../shared/s3-client';
import { v4 as uuidv4 } from 'uuid';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({});
const REPORTS_BUCKET = process.env.REPORTS_BUCKET || '';

// ============================================================================
// Types
// ============================================================================

interface BrandKit {
  id: string;
  tenant_id: string;
  name: string;
  logo_url?: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  header_font: string;
  company_name: string;
  tagline: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface AIReport {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  template_id?: string;
  brand_kit_id?: string;
  content: GeneratedReport | string;
  status: 'draft' | 'generating' | 'complete' | 'error';
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Response Helper
// ============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = event.requestContext?.authorizer?.tenantId;
    const userId = event.requestContext?.authorizer?.userId || 'system';
    
    if (!tenantId) {
      return response(400, { error: 'Tenant ID required' });
    }

    const path = event.path.replace('/api/admin/ai-reports', '').replace('/admin/ai-reports', '');
    const method = event.httpMethod;

    // Route handling
    if (path === '' || path === '/') {
      if (method === 'GET') return listReports(tenantId);
      if (method === 'POST') return generateReport(tenantId, userId, event);
    }

    if (path === '/templates') {
      if (method === 'GET') return listTemplates(tenantId);
      if (method === 'POST') return createTemplate(tenantId, event);
    }

    if (path === '/brand-kits') {
      if (method === 'GET') return listBrandKits(tenantId);
      if (method === 'POST') return createBrandKit(tenantId, event);
    }

    if (path === '/insights/dashboard') {
      if (method === 'GET') return getInsightsDashboard(tenantId);
    }

    // Dynamic routes
    const reportMatch = path.match(/^\/([a-f0-9-]+)$/);
    if (reportMatch) {
      const reportId = reportMatch[1];
      if (method === 'GET') return getReport(tenantId, reportId);
      if (method === 'PUT') return updateReport(tenantId, reportId, event);
      if (method === 'DELETE') return deleteReport(tenantId, reportId);
    }

    const exportMatch = path.match(/^\/([a-f0-9-]+)\/export$/);
    if (exportMatch && method === 'POST') {
      return exportReport(tenantId, exportMatch[1], event);
    }

    const chatMatch = path.match(/^\/([a-f0-9-]+)\/chat$/);
    if (chatMatch && method === 'POST') {
      return handleChat(tenantId, chatMatch[1], event);
    }

    const brandKitMatch = path.match(/^\/brand-kits\/([a-f0-9-]+)$/);
    if (brandKitMatch) {
      const kitId = brandKitMatch[1];
      if (method === 'PUT') return updateBrandKit(tenantId, kitId, event);
      if (method === 'DELETE') return deleteBrandKit(tenantId, kitId);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('AI Reports handler error:', error);
    return response(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Report Handlers
// ============================================================================

async function listReports(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT id, title, description, template_id, brand_kit_id, status, created_by, created_at, updated_at
     FROM ai_reports WHERE tenant_id = $1 ORDER BY updated_at DESC`,
    [stringParam('tenantId', tenantId)]
  );

  return response(200, { reports: result.rows || [] });
}

async function getReport(tenantId: string, reportId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM ai_reports WHERE id = $1 AND tenant_id = $2`,
    [stringParam('reportId', reportId), stringParam('tenantId', tenantId)]
  );

  if (!result.rows || result.rows.length === 0) {
    return response(404, { error: 'Report not found' });
  }

  return response(200, { report: result.rows[0] });
}

async function generateReport(tenantId: string, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { title, description, template_id, brand_kit_id, prompt, parameters } = body;

  if (!title || !prompt) {
    return response(400, { error: 'Title and prompt are required' });
  }

  const reportId = uuidv4();

  // Insert draft report
  await executeStatement(
    `INSERT INTO ai_reports (id, tenant_id, title, description, template_id, brand_kit_id, content, status, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'generating', $8, NOW(), NOW())`,
    [
      stringParam('id', reportId),
      stringParam('tenantId', tenantId),
      stringParam('title', title),
      stringParam('description', description || null),
      stringParam('templateId', template_id || null),
      stringParam('brandKitId', brand_kit_id || null),
      stringParam('content', '{}'),
      stringParam('userId', userId),
    ]
  );

  try {
    // Generate report content with AI
    const generatedContent = await invokeBedrockModel(prompt, parameters || {});

    // Update report with generated content
    await executeStatement(
      `UPDATE ai_reports SET content = $1, status = 'complete', updated_at = NOW() WHERE id = $2`,
      [stringParam('content', JSON.stringify(generatedContent)), stringParam('id', reportId)]
    );

    // Generate smart insights
    await generateSmartInsights(tenantId, reportId, generatedContent);

    return response(201, { 
      report: { 
        id: reportId, 
        title, 
        description, 
        content: generatedContent, 
        status: 'complete' 
      } 
    });
  } catch (error) {
    console.error('Report generation error:', error);
    await executeStatement(
      `UPDATE ai_reports SET status = 'error', updated_at = NOW() WHERE id = $1`,
      [stringParam('id', reportId)]
    );
    return response(500, { error: 'Failed to generate report' });
  }
}

async function updateReport(tenantId: string, reportId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { title, description, content } = body;

  const updates: string[] = [];
  const params = [stringParam('reportId', reportId), stringParam('tenantId', tenantId)];
  let paramIndex = 3;

  if (title) {
    updates.push(`title = $${paramIndex}`);
    params.push(stringParam('title', title));
    paramIndex++;
  }
  if (description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    params.push(stringParam('description', description));
    paramIndex++;
  }
  if (content) {
    updates.push(`content = $${paramIndex}`);
    params.push(stringParam('content', JSON.stringify(content)));
    paramIndex++;
  }

  if (updates.length === 0) {
    return response(400, { error: 'No updates provided' });
  }

  updates.push('updated_at = NOW()');

  await executeStatement(
    `UPDATE ai_reports SET ${updates.join(', ')} WHERE id = $1 AND tenant_id = $2`,
    params
  );

  return response(200, { success: true });
}

async function deleteReport(tenantId: string, reportId: string): Promise<APIGatewayProxyResult> {
  await executeStatement(
    `DELETE FROM ai_reports WHERE id = $1 AND tenant_id = $2`,
    [stringParam('reportId', reportId), stringParam('tenantId', tenantId)]
  );

  return response(200, { success: true });
}

async function exportReport(tenantId: string, reportId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { format } = body;

  if (!['pdf', 'excel', 'html', 'json'].includes(format)) {
    return response(400, { error: 'Invalid format. Use pdf, excel, html, or json' });
  }

  // Get report
  const reportResult = await executeStatement(
    `SELECT * FROM ai_reports WHERE id = $1 AND tenant_id = $2`,
    [stringParam('reportId', reportId), stringParam('tenantId', tenantId)]
  );

  if (!reportResult.rows || reportResult.rows.length === 0) {
    return response(404, { error: 'Report not found' });
  }

  const report = reportResult.rows[0] as unknown as AIReport;
  const content = typeof report.content === 'string' ? JSON.parse(report.content) : report.content;

  // Get brand kit if specified
  let brandKit: BrandKit | null = null;
  if (report.brand_kit_id) {
    const kitResult = await executeStatement(
      `SELECT * FROM ai_report_brand_kits WHERE id = $1 AND tenant_id = $2`,
      [stringParam('kitId', report.brand_kit_id), stringParam('tenantId', tenantId)]
    );
    if (kitResult.rows && kitResult.rows.length > 0) {
      brandKit = kitResult.rows[0] as unknown as BrandKit;
    }
  }

  // Convert to GeneratedReport format
  const generatedReport: GeneratedReport = {
    title: content.title || report.title,
    subtitle: content.subtitle,
    executive_summary: content.executive_summary,
    sections: content.sections || [],
    charts: content.charts,
    tables: content.tables,
    smart_insights: content.smart_insights,
    created_at: report.created_at,
    data_range_start: content.data_range_start,
    data_range_end: content.data_range_end,
    confidence_score: content.confidence_score,
  };

  // Generate export
  let exportBuffer: Buffer;
  let contentType: string;
  let extension: string;

  const brandKitForExport = brandKit ? {
    logoUrl: brandKit.logo_url,
    primaryColor: brandKit.primary_color,
    secondaryColor: brandKit.secondary_color,
    accentColor: brandKit.accent_color,
    fontFamily: brandKit.font_family,
    headerFont: brandKit.header_font,
    companyName: brandKit.company_name,
    tagline: brandKit.tagline,
  } : null;

  switch (format) {
    case 'pdf':
      exportBuffer = await generatePdfReport(generatedReport, brandKitForExport);
      contentType = 'application/pdf';
      extension = 'pdf';
      break;
    case 'excel':
      exportBuffer = await generateExcelReport(generatedReport);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
      break;
    case 'html':
      exportBuffer = Buffer.from(await generateHtmlReport(generatedReport, brandKitForExport));
      contentType = 'text/html';
      extension = 'html';
      break;
    case 'json':
      exportBuffer = Buffer.from(JSON.stringify(generatedReport, null, 2));
      contentType = 'application/json';
      extension = 'json';
      break;
    default:
      return response(400, { error: 'Unsupported format' });
  }

  // Upload to S3
  const key = `reports/${tenantId}/${reportId}/${Date.now()}.${extension}`;
  await uploadToS3({
    bucket: REPORTS_BUCKET,
    key,
    body: exportBuffer,
    contentType,
  });

  // Generate signed URL
  const downloadUrl = await getSignedUrl({
    bucket: REPORTS_BUCKET,
    key,
    expiresIn: 3600,
  });

  return response(200, { downloadUrl, format, key });
}

// ============================================================================
// Template Handlers
// ============================================================================

async function listTemplates(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM ai_report_templates 
     WHERE tenant_id = $1 OR is_system = true 
     ORDER BY is_system DESC, name ASC`,
    [stringParam('tenantId', tenantId)]
  );

  return response(200, { templates: result.rows || [] });
}

async function createTemplate(tenantId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { name, description, category, prompt_template, default_parameters } = body;

  if (!name || !prompt_template) {
    return response(400, { error: 'Name and prompt_template are required' });
  }

  const templateId = uuidv4();

  await executeStatement(
    `INSERT INTO ai_report_templates (id, tenant_id, name, description, category, prompt_template, default_parameters, is_system, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())`,
    [
      stringParam('id', templateId),
      stringParam('tenantId', tenantId),
      stringParam('name', name),
      stringParam('description', description || ''),
      stringParam('category', category || 'custom'),
      stringParam('promptTemplate', prompt_template),
      stringParam('defaultParameters', JSON.stringify(default_parameters || {})),
    ]
  );

  return response(201, { template: { id: templateId, name, description, category } });
}

// ============================================================================
// Brand Kit Handlers
// ============================================================================

async function listBrandKits(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT * FROM ai_report_brand_kits WHERE tenant_id = $1 ORDER BY is_default DESC, name ASC`,
    [stringParam('tenantId', tenantId)]
  );

  return response(200, { brandKits: result.rows || [] });
}

async function createBrandKit(tenantId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { 
    name, logo_url, primary_color, secondary_color, accent_color, 
    font_family, header_font, company_name, tagline, is_default 
  } = body;

  if (!name || !company_name) {
    return response(400, { error: 'Name and company_name are required' });
  }

  const kitId = uuidv4();

  // If setting as default, unset other defaults
  if (is_default) {
    await executeStatement(
      `UPDATE ai_report_brand_kits SET is_default = false WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );
  }

  await executeStatement(
    `INSERT INTO ai_report_brand_kits (id, tenant_id, name, logo_url, primary_color, secondary_color, accent_color, font_family, header_font, company_name, tagline, is_default, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
    [
      stringParam('id', kitId),
      stringParam('tenantId', tenantId),
      stringParam('name', name),
      stringParam('logoUrl', logo_url || null),
      stringParam('primaryColor', primary_color || '#3b82f6'),
      stringParam('secondaryColor', secondary_color || '#64748b'),
      stringParam('accentColor', accent_color || '#8b5cf6'),
      stringParam('fontFamily', font_family || 'Inter'),
      stringParam('headerFont', header_font || 'Inter'),
      stringParam('companyName', company_name),
      stringParam('tagline', tagline || ''),
      stringParam('isDefault', is_default ? 'true' : 'false'),
    ]
  );

  return response(201, { brandKit: { id: kitId, name, company_name } });
}

async function updateBrandKit(tenantId: string, kitId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  
  const allowedFields = [
    'name', 'logo_url', 'primary_color', 'secondary_color', 'accent_color',
    'font_family', 'header_font', 'company_name', 'tagline', 'is_default'
  ];

  const updates: string[] = [];
  const params = [stringParam('kitId', kitId), stringParam('tenantId', tenantId)];
  let paramIndex = 3;

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      params.push(stringParam(field, String(body[field])));
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    return response(400, { error: 'No updates provided' });
  }

  // If setting as default, unset other defaults first
  if (body.is_default) {
    await executeStatement(
      `UPDATE ai_report_brand_kits SET is_default = false WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );
  }

  updates.push('updated_at = NOW()');

  await executeStatement(
    `UPDATE ai_report_brand_kits SET ${updates.join(', ')} WHERE id = $1 AND tenant_id = $2`,
    params
  );

  return response(200, { success: true });
}

async function deleteBrandKit(tenantId: string, kitId: string): Promise<APIGatewayProxyResult> {
  await executeStatement(
    `DELETE FROM ai_report_brand_kits WHERE id = $1 AND tenant_id = $2`,
    [stringParam('kitId', kitId), stringParam('tenantId', tenantId)]
  );

  return response(200, { success: true });
}

// ============================================================================
// Chat Handler
// ============================================================================

async function handleChat(tenantId: string, reportId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { message } = body;

  if (!message) {
    return response(400, { error: 'Message is required' });
  }

  // Get current report
  const reportResult = await executeStatement(
    `SELECT * FROM ai_reports WHERE id = $1 AND tenant_id = $2`,
    [stringParam('reportId', reportId), stringParam('tenantId', tenantId)]
  );

  if (!reportResult.rows || reportResult.rows.length === 0) {
    return response(404, { error: 'Report not found' });
  }

  const report = reportResult.rows[0] as unknown as AIReport;
  const currentContent = typeof report.content === 'string' ? JSON.parse(report.content) : report.content;

  // Use AI to modify report based on chat message
  const modificationPrompt = `
You are modifying an AI-generated report based on user feedback.

Current report:
${JSON.stringify(currentContent, null, 2)}

User request: ${message}

Respond with the modified report in the same JSON structure. Only make changes relevant to the user's request.
`;

  try {
    const modifiedContent = await invokeBedrockModel(modificationPrompt, {});

    // Update report
    await executeStatement(
      `UPDATE ai_reports SET content = $1, updated_at = NOW() WHERE id = $2`,
      [stringParam('content', JSON.stringify(modifiedContent)), stringParam('id', reportId)]
    );

    return response(200, { 
      report: { ...report, content: modifiedContent },
      message: 'Report updated successfully'
    });
  } catch (error) {
    console.error('Chat modification error:', error);
    return response(500, { error: 'Failed to modify report' });
  }
}

// ============================================================================
// Insights Dashboard Handler
// ============================================================================

async function getInsightsDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  // Get recent insights
  const insightsResult = await executeStatement(
    `SELECT * FROM ai_report_insights 
     WHERE tenant_id = $1 
     ORDER BY created_at DESC 
     LIMIT 50`,
    [stringParam('tenantId', tenantId)]
  );

  // Get insight stats
  const statsResult = await executeStatement(
    `SELECT 
       COUNT(*) as total_insights,
       COUNT(CASE WHEN type = 'anomaly' THEN 1 END) as anomalies,
       COUNT(CASE WHEN type = 'trend' THEN 1 END) as trends,
       COUNT(CASE WHEN type = 'recommendation' THEN 1 END) as recommendations,
       COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity
     FROM ai_report_insights 
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
    [stringParam('tenantId', tenantId)]
  );

  return response(200, {
    insights: insightsResult.rows || [],
    stats: statsResult.rows?.[0] || {},
  });
}

// ============================================================================
// AI Helpers
// ============================================================================

async function invokeBedrockModel(prompt: string, parameters: Record<string, unknown>): Promise<GeneratedReport> {
  const systemPrompt = buildReportSystemPrompt();
  
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt + (Object.keys(parameters).length > 0 ? `\n\nParameters: ${JSON.stringify(parameters)}` : ''),
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  const resp = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(resp.body));
  
  return parseAIReportResponse(responseBody.content[0].text);
}

function buildReportSystemPrompt(): string {
  return `You are an expert business analyst generating professional reports. 
Your output must be valid JSON matching this structure:
{
  "title": "Report Title",
  "subtitle": "Optional subtitle",
  "executive_summary": "Brief summary of key findings",
  "sections": [
    {
      "id": "unique-id",
      "type": "heading|paragraph|metrics|chart|table|quote|list",
      "content": "Section content",
      "level": 1|2|3,
      "items": ["list items if type is list"],
      "metrics": [{"label": "Metric", "value": "100", "change": "+10%", "trend": "up|down|neutral"}]
    }
  ],
  "charts": [
    {"type": "bar|line|pie|area", "title": "Chart Title", "data": [{"label": "A", "value": 100}]}
  ],
  "tables": [
    {"title": "Table Title", "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]]}
  ],
  "smart_insights": [
    {
      "type": "anomaly|trend|recommendation|warning|achievement",
      "title": "Insight Title",
      "description": "Detailed description",
      "metric": "Optional metric name",
      "value": "Optional value",
      "change": "Optional change",
      "severity": "low|medium|high",
      "confidence": 0.95
    }
  ],
  "created_at": "ISO timestamp",
  "confidence_score": 0.85
}

Generate comprehensive, data-driven insights. Be specific and actionable.`;
}

function parseAIReportResponse(text: string): GeneratedReport {
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  
  // Ensure required fields
  return {
    title: parsed.title || 'Untitled Report',
    subtitle: parsed.subtitle,
    executive_summary: parsed.executive_summary,
    sections: parsed.sections || [],
    charts: parsed.charts,
    tables: parsed.tables,
    smart_insights: parsed.smart_insights,
    created_at: parsed.created_at || new Date().toISOString(),
    data_range_start: parsed.data_range_start,
    data_range_end: parsed.data_range_end,
    confidence_score: parsed.confidence_score,
  };
}

async function generateSmartInsights(tenantId: string, reportId: string, content: GeneratedReport): Promise<void> {
  if (!content.smart_insights || content.smart_insights.length === 0) {
    return;
  }

  for (const insight of content.smart_insights) {
    const insightId = uuidv4();
    await executeStatement(
      `INSERT INTO ai_report_insights (id, tenant_id, report_id, type, title, description, metric, value, change, severity, confidence, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        stringParam('id', insightId),
        stringParam('tenantId', tenantId),
        stringParam('reportId', reportId),
        stringParam('type', insight.type),
        stringParam('title', insight.title),
        stringParam('description', insight.description),
        stringParam('metric', insight.metric || null),
        stringParam('value', insight.value || null),
        stringParam('change', insight.change || null),
        stringParam('severity', insight.severity),
        stringParam('confidence', String(insight.confidence)),
      ]
    );
  }
}

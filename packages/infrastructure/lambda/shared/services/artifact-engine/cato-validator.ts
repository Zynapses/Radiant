// ============================================================================
// RADIANT Artifact Engine - Cato Validator Service
// packages/infrastructure/lambda/shared/services/artifact-engine/cato-validator.ts
// Version: 4.19.0
// ============================================================================

import { query } from '../../db/pool-manager';
import {
  ArtifactValidationResult,
  ArtifactValidationRuleRow,
  ArtifactDependencyAllowlistRow,
  ValidationSeverity,
} from './types';

export class CatoArtifactValidator {
  /**
   * Validate generated code against all active CBFs
   */
  async validate(
    code: string,
    sessionId: string,
    tenantId: string
  ): Promise<ArtifactValidationResult> {
    const errors: ArtifactValidationResult['errors'] = [];
    const warnings: ArtifactValidationResult['warnings'] = [];
    const passedCBFs: string[] = [];
    const failedCBFs: string[] = [];

    // Get all active validation rules
    const rulesResult = await query<ArtifactValidationRuleRow>(
      `SELECT * FROM artifact_validation_rules WHERE is_active = TRUE`
    );

    // Get allowed dependencies
    const allowedDeps = await this.getAllowedDependencies(tenantId);

    for (const rule of rulesResult.rows) {
      const result = await this.evaluateRule(rule, code, allowedDeps);

      if (result.passed) {
        passedCBFs.push(rule.rule_name);
      } else {
        failedCBFs.push(rule.rule_name);

        if (rule.severity === 'block') {
          errors.push({
            rule: rule.rule_name,
            severity: rule.severity,
            message: result.message || rule.error_message || 'Validation failed',
            line: result.line,
            column: result.column,
          });
        } else if (rule.severity === 'warn') {
          warnings.push({
            rule: rule.rule_name,
            message: result.message || rule.error_message || 'Warning',
          });
        }
      }
    }

    // Calculate security score
    const totalRules = rulesResult.rows.length;
    const passedRules = passedCBFs.length;
    const securityScore = totalRules > 0 ? passedRules / totalRules : 0;

    // Only blocking errors make validation fail
    const blockingErrors = errors.filter((e) => e.severity === 'block');
    const isValid = blockingErrors.length === 0;

    // Log validation result
    await query(
      `INSERT INTO artifact_generation_logs (session_id, log_type, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        sessionId,
        isValid ? 'success' : 'error',
        isValid
          ? `Passed ${passedCBFs.length}/${totalRules} security checks`
          : `Failed ${failedCBFs.length} security checks: ${failedCBFs.join(', ')}`,
        JSON.stringify({ passedCBFs, failedCBFs, securityScore }),
      ]
    );

    return {
      isValid,
      errors,
      warnings,
      securityScore,
      passedCBFs,
      failedCBFs,
    };
  }

  /**
   * Evaluate a single validation rule
   */
  private async evaluateRule(
    rule: ArtifactValidationRuleRow,
    code: string,
    allowedDeps: string[]
  ): Promise<{ passed: boolean; message?: string; line?: number; column?: number }> {
    // Handle special rule types
    if (rule.rule_type === 'resource_limit' && rule.rule_name === 'max_lines') {
      const lineCount = code.split('\n').length;
      if (lineCount > 500) {
        return {
          passed: false,
          message: `Code has ${lineCount} lines, maximum is 500`,
        };
      }
      return { passed: true };
    }

    if (rule.rule_type === 'dependency_check' && rule.rule_name === 'allowed_imports') {
      const importResult = this.checkImports(code, allowedDeps);
      return importResult;
    }

    // Handle regex-based rules
    if (rule.validation_pattern) {
      try {
        const regex = new RegExp(rule.validation_pattern, 'gi');
        const match = regex.exec(code);

        if (match) {
          // Find line number
          const beforeMatch = code.substring(0, match.index);
          const line = beforeMatch.split('\n').length;

          return {
            passed: false,
            message: rule.error_message || `Pattern matched: ${rule.validation_pattern}`,
            line,
          };
        }
        return { passed: true };
      } catch {
        // Invalid regex, skip this rule
        return { passed: true };
      }
    }

    // Default pass if no validation logic
    return { passed: true };
  }

  /**
   * Check that all imports are in the allowlist
   */
  private checkImports(
    code: string,
    allowedDeps: string[]
  ): { passed: boolean; message?: string; line?: number } {
    // Match various import patterns
    const importPatterns = [
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    const disallowedImports: string[] = [];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const importPath = match[1];

        // Skip relative imports
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          continue;
        }

        // Get package name (handle scoped packages)
        const packageName = importPath.startsWith('@')
          ? importPath.split('/').slice(0, 2).join('/')
          : importPath.split('/')[0];

        // Check if allowed
        if (!allowedDeps.includes(packageName)) {
          disallowedImports.push(packageName);
        }
      }
    }

    if (disallowedImports.length > 0) {
      const unique = [...new Set(disallowedImports)];
      return {
        passed: false,
        message: `Disallowed imports: ${unique.join(', ')}. Allowed: ${allowedDeps.slice(0, 10).join(', ')}...`,
      };
    }

    return { passed: true };
  }

  /**
   * Get allowed dependencies for tenant
   */
  private async getAllowedDependencies(tenantId: string): Promise<string[]> {
    const result = await query<ArtifactDependencyAllowlistRow>(
      `SELECT package_name FROM artifact_dependency_allowlist
       WHERE is_active = TRUE AND (tenant_id IS NULL OR tenant_id = $1)`,
      [tenantId]
    );
    return result.rows.map((row) => row.package_name);
  }

  /**
   * Get all validation rules (for admin display)
   */
  async getValidationRules(): Promise<ArtifactValidationRuleRow[]> {
    const result = await query<ArtifactValidationRuleRow>(
      `SELECT * FROM artifact_validation_rules ORDER BY rule_type, rule_name`
    );
    return result.rows;
  }

  /**
   * Get all allowed dependencies (for admin display)
   */
  async getAllowedDependenciesAdmin(
    tenantId: string
  ): Promise<ArtifactDependencyAllowlistRow[]> {
    const result = await query<ArtifactDependencyAllowlistRow>(
      `SELECT * FROM artifact_dependency_allowlist
       WHERE is_active = TRUE AND (tenant_id IS NULL OR tenant_id = $1)
       ORDER BY package_name`,
      [tenantId]
    );
    return result.rows;
  }
}

export const catoArtifactValidator = new CatoArtifactValidator();

/**
 * LIVS-M Version Service
 * 
 * Manages version checking, upgrade notifications, and policy registry upgrades.
 * Tenants can see when new LIVS-M versions are available and upgrade with one click.
 * 
 * @version 1.0.0
 * @since v7.9.0
 */

import { Pool } from 'pg';
import {
  LIVS_M_CURRENT_VERSION,
  LIVS_M_VERSION_HISTORY,
  LIVSVersionInfo,
  LIVSVersionCheckResult,
  LIVSTenantVersionState,
  compareLIVSVersions,
  getLIVSChangelogBetween,
} from '@radiant/shared';

export interface LIVSVersionServiceDeps {
  pool: Pool;
}

export class LIVSVersionService {
  private pool: Pool;

  constructor(deps: LIVSVersionServiceDeps) {
    this.pool = deps.pool;
  }

  /**
   * Get the tenant's current installed LIVS-M version
   */
  async getTenantVersion(tenantId: string): Promise<LIVSTenantVersionState> {
    const result = await this.pool.query(
      `SELECT installed_version, last_upgraded, auto_upgrade, upgrade_history
       FROM livs_tenant_version
       WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      // First time - initialize with current version
      const initialState: LIVSTenantVersionState = {
        tenantId,
        installedVersion: LIVS_M_CURRENT_VERSION,
        lastUpgraded: null,
        autoUpgrade: false,
        upgradeHistory: [],
      };
      
      await this.initializeTenantVersion(tenantId, initialState);
      return initialState;
    }

    return {
      tenantId,
      installedVersion: result.rows[0].installed_version,
      lastUpgraded: result.rows[0].last_upgraded,
      autoUpgrade: result.rows[0].auto_upgrade,
      upgradeHistory: result.rows[0].upgrade_history || [],
    };
  }

  /**
   * Initialize version tracking for a tenant
   */
  private async initializeTenantVersion(
    tenantId: string,
    state: LIVSTenantVersionState
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO livs_tenant_version (tenant_id, installed_version, auto_upgrade, upgrade_history)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, state.installedVersion, state.autoUpgrade, JSON.stringify(state.upgradeHistory)]
    );
  }

  /**
   * Check if updates are available for a tenant
   */
  async checkForUpdates(tenantId: string): Promise<LIVSVersionCheckResult> {
    const tenantState = await this.getTenantVersion(tenantId);
    const latestVersion = LIVS_M_CURRENT_VERSION;
    const updateAvailable = compareLIVSVersions(tenantState.installedVersion, latestVersion) < 0;

    let changelog: string[] = [];
    let breakingChanges = false;
    let migrationRequired = false;

    if (updateAvailable) {
      changelog = getLIVSChangelogBetween(tenantState.installedVersion, latestVersion);
      
      // Check if any version in the upgrade path has breaking changes
      for (const release of LIVS_M_VERSION_HISTORY) {
        if (compareLIVSVersions(release.version, tenantState.installedVersion) > 0 &&
            compareLIVSVersions(release.version, latestVersion) <= 0) {
          if (release.breakingChanges) breakingChanges = true;
          if (release.migrationRequired) migrationRequired = true;
        }
      }
    }

    return {
      currentVersion: LIVS_M_CURRENT_VERSION,
      latestVersion,
      installedVersion: tenantState.installedVersion,
      updateAvailable,
      changelog,
      breakingChanges,
      migrationRequired,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Upgrade tenant to the latest LIVS-M version
   */
  async upgradeTenant(
    tenantId: string,
    upgradedBy: string
  ): Promise<{ success: boolean; fromVersion: string; toVersion: string; message: string }> {
    const tenantState = await this.getTenantVersion(tenantId);
    const latestVersion = LIVS_M_CURRENT_VERSION;

    if (compareLIVSVersions(tenantState.installedVersion, latestVersion) >= 0) {
      return {
        success: false,
        fromVersion: tenantState.installedVersion,
        toVersion: latestVersion,
        message: 'Already on the latest version',
      };
    }

    const fromVersion = tenantState.installedVersion;
    const upgradeEntry = {
      fromVersion,
      toVersion: latestVersion,
      upgradedAt: new Date().toISOString(),
      upgradedBy,
    };

    const newHistory = [...tenantState.upgradeHistory, upgradeEntry];

    await this.pool.query(
      `UPDATE livs_tenant_version
       SET installed_version = $1,
           last_upgraded = NOW(),
           upgrade_history = $2
       WHERE tenant_id = $3`,
      [latestVersion, JSON.stringify(newHistory), tenantId]
    );

    // Log the upgrade
    await this.logUpgrade(tenantId, fromVersion, latestVersion, upgradedBy);

    return {
      success: true,
      fromVersion,
      toVersion: latestVersion,
      message: `Successfully upgraded from v${fromVersion} to v${latestVersion}`,
    };
  }

  /**
   * Set auto-upgrade preference for a tenant
   */
  async setAutoUpgrade(tenantId: string, enabled: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE livs_tenant_version
       SET auto_upgrade = $1
       WHERE tenant_id = $2`,
      [enabled, tenantId]
    );
  }

  /**
   * Log upgrade to history table
   */
  private async logUpgrade(
    tenantId: string,
    fromVersion: string,
    toVersion: string,
    upgradedBy: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO livs_version_upgrades (tenant_id, from_version, to_version, upgraded_by)
       VALUES ($1, $2, $3, $4)`,
      [tenantId, fromVersion, toVersion, upgradedBy]
    );
  }

  /**
   * Get all version info (for admin display)
   */
  getAllVersions(): LIVSVersionInfo[] {
    return LIVS_M_VERSION_HISTORY;
  }

  /**
   * Get the latest version info
   */
  getLatestVersionInfo(): LIVSVersionInfo | undefined {
    return LIVS_M_VERSION_HISTORY.find(v => v.version === LIVS_M_CURRENT_VERSION);
  }
}

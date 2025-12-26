/**
 * Authentication Commands
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { setConfig, getApiKey, getBaseUrl, config } from '../config.js';

export function authCommands(program: Command): void {
  const auth = program
    .command('auth')
    .description('Manage authentication');

  auth
    .command('login')
    .description('Configure API key')
    .option('-k, --key <key>', 'API key')
    .action(async (options: { key?: string }) => {
      let apiKey = options.key;

      if (!apiKey) {
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: 'Enter your RADIANT API key:',
            mask: '*',
            validate: (input: string) => input.length > 0 || 'API key is required',
          },
        ]);
        apiKey = answers.apiKey;
      }

      setConfig('apiKey', apiKey);
      console.log(chalk.green('✓ API key saved successfully'));
    });

  auth
    .command('logout')
    .description('Remove stored API key')
    .action(() => {
      config.delete('apiKey');
      console.log(chalk.green('✓ API key removed'));
    });

  auth
    .command('status')
    .description('Check authentication status')
    .action(() => {
      const apiKey = getApiKey();
      if (apiKey) {
        const masked = apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
        console.log(chalk.green('✓ Authenticated'));
        console.log(`  API Key: ${masked}`);
      } else {
        console.log(chalk.yellow('✗ Not authenticated'));
        console.log('  Run "radiant auth login" to configure');
      }
    });

  auth
    .command('whoami')
    .description('Show current user info')
    .action(async () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.log(chalk.red('Not authenticated'));
        return;
      }

      try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/v2/auth/me`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            console.log(chalk.red('✗ Invalid or expired API key'));
            return;
          }
          throw new Error(`API error: ${response.status}`);
        }

        const user = await response.json() as {
          id: string;
          email: string;
          name?: string;
          tenantId: string;
          role: string;
          createdAt: string;
        };

        console.log(chalk.green('✓ Authenticated'));
        console.log(`  ${chalk.bold('User ID:')} ${user.id}`);
        console.log(`  ${chalk.bold('Email:')} ${user.email}`);
        if (user.name) {
          console.log(`  ${chalk.bold('Name:')} ${user.name}`);
        }
        console.log(`  ${chalk.bold('Tenant:')} ${user.tenantId}`);
        console.log(`  ${chalk.bold('Role:')} ${user.role}`);
      } catch (error) {
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });
}

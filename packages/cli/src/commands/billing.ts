/**
 * Billing Commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { apiRequest } from '../api.js';
import { handleError } from '../errors.js';

interface CreditBalance {
  available: number;
  reserved: number;
  currency: string;
  updated_at: string;
}

interface UsageData {
  date: string;
  model: string;
  requests: number;
  tokens: number;
  cost: number;
}

export function billingCommands(program: Command): void {
  const billing = program
    .command('billing')
    .description('Manage billing and credits');

  billing
    .command('credits')
    .description('Check credit balance')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const spinner = ora('Fetching balance...').start();
        const response = await apiRequest<{ data: CreditBalance }>('GET', '/billing/credits');
        spinner.stop();

        const balance = response.data;

        if (options.json) {
          console.log(JSON.stringify(balance, null, 2));
          return;
        }

        console.log(chalk.bold('\nCredit Balance\n'));
        console.log(`  ${chalk.cyan('Available:')}  ${formatCurrency(balance.available, balance.currency)}`);
        console.log(`  ${chalk.cyan('Reserved:')}   ${formatCurrency(balance.reserved, balance.currency)}`);
        console.log(`  ${chalk.gray('Updated:')}    ${new Date(balance.updated_at).toLocaleString()}`);
        console.log();
      } catch (error) {
        handleError(error);
      }
    });

  billing
    .command('usage')
    .description('View usage history')
    .option('--start <date>', 'Start date (YYYY-MM-DD)')
    .option('--end <date>', 'End date (YYYY-MM-DD)')
    .option('--json', 'Output as JSON')
    .action(async (options: { start?: string; end?: string; json?: boolean }) => {
      try {
        let path = '/billing/usage';
        const params: string[] = [];
        
        if (options.start) params.push(`start_date=${options.start}`);
        if (options.end) params.push(`end_date=${options.end}`);
        if (params.length) path += '?' + params.join('&');

        const spinner = ora('Fetching usage...').start();
        const response = await apiRequest<{ data: UsageData[] }>('GET', path);
        spinner.stop();

        const usage = response.data;

        if (options.json) {
          console.log(JSON.stringify(usage, null, 2));
          return;
        }

        if (!usage || usage.length === 0) {
          console.log(chalk.yellow('No usage data found'));
          return;
        }

        const tableData = [
          [
            chalk.bold('Date'),
            chalk.bold('Model'),
            chalk.bold('Requests'),
            chalk.bold('Tokens'),
            chalk.bold('Cost'),
          ],
          ...usage.map(u => [
            u.date,
            u.model,
            u.requests.toLocaleString(),
            u.tokens.toLocaleString(),
            formatCurrency(u.cost, 'USD'),
          ]),
        ];

        console.log(table(tableData));

        const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);
        const totalTokens = usage.reduce((sum, u) => sum + u.tokens, 0);
        console.log(chalk.bold(`Total: ${totalTokens.toLocaleString()} tokens, ${formatCurrency(totalCost, 'USD')}`));
      } catch (error) {
        handleError(error);
      }
    });

  billing
    .command('estimate')
    .description('Estimate cost for a request')
    .option('-m, --model <model>', 'Model to use', 'gpt-4o')
    .option('-i, --input <tokens>', 'Input tokens', '1000')
    .option('-o, --output <tokens>', 'Output tokens', '500')
    .action(async (options: { model: string; input: string; output: string }) => {
      try {
        const spinner = ora('Calculating...').start();
        const response = await apiRequest<{ data: { id: string; input_cost_per_1k: number; output_cost_per_1k: number } }>(
          'GET',
          `/models/${options.model}`
        );
        spinner.stop();

        const model = response.data;
        const inputTokens = parseInt(options.input, 10);
        const outputTokens = parseInt(options.output, 10);

        const inputCost = (inputTokens / 1000) * model.input_cost_per_1k;
        const outputCost = (outputTokens / 1000) * model.output_cost_per_1k;
        const totalCost = inputCost + outputCost;

        console.log(chalk.bold('\nCost Estimate\n'));
        console.log(`  ${chalk.cyan('Model:')}         ${model.id}`);
        console.log(`  ${chalk.cyan('Input:')}         ${inputTokens.toLocaleString()} tokens → ${formatCurrency(inputCost, 'USD')}`);
        console.log(`  ${chalk.cyan('Output:')}        ${outputTokens.toLocaleString()} tokens → ${formatCurrency(outputCost, 'USD')}`);
        console.log(`  ${chalk.green('Total:')}         ${formatCurrency(totalCost, 'USD')}`);
        console.log();
      } catch (error) {
        handleError(error);
      }
    });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

"use strict";
/**
 * RADIANT v4.17.0 - Formatting Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.formatNumber = formatNumber;
exports.formatTokens = formatTokens;
exports.formatBytes = formatBytes;
exports.formatDuration = formatDuration;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.slugify = slugify;
exports.truncate = truncate;
function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(amount);
}
function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}
function formatTokens(tokens) {
    if (tokens >= 1_000_000_000) {
        return `${(tokens / 1_000_000_000).toFixed(2)}B`;
    }
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(2)}M`;
    }
    if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(2)}K`;
    }
    return tokens.toString();
}
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    if (ms < 60_000) {
        return `${(ms / 1000).toFixed(2)}s`;
    }
    if (ms < 3_600_000) {
        return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
    }
    return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}
function formatDate(date) {
    return date.toISOString().split('T')[0];
}
function formatDateTime(date) {
    return date.toISOString().replace('T', ' ').split('.')[0];
}
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function truncate(text, maxLength, suffix = '...') {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - suffix.length) + suffix;
}
//# sourceMappingURL=formatting.js.map
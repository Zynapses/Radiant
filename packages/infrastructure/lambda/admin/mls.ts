// RADIANT v6.5.0 - MLS Admin API
// RFC 9420-inspired group encryption management for agent-to-agent communication

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractAuthContext } from '../shared/auth';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { Logger } from '../shared/logger';

const logger = new Logger({ handler: 'mls' });

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function jsonResponse(data: unknown, statusCode = 200): APIGatewayProxyResult {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(data) };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: corsHeaders, body: JSON.stringify({ error: message }) };
}

// ============================================================================
// Route Handler
// ============================================================================

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace(/^\/api\/admin\/mls/, '');
  const method = event.httpMethod;

  try {
    const auth = extractAuthContext(event);
    const tenantId = auth.tenantId;

    if (!tenantId) {
      return errorResponse(401, 'Tenant ID required');
    }

    // Set tenant context
    await executeStatement(`SET app.current_tenant_id = '${tenantId}'`, []);

    // Route requests
    // Dashboard
    if (path === '/dashboard' && method === 'GET') {
      return getDashboard(tenantId);
    }

    // Key Packages
    if (path === '/key-packages' && method === 'POST') {
      return createKeyPackage(event);
    }
    if (path.startsWith('/key-packages/') && method === 'GET') {
      return getKeyPackage(path.split('/')[2]);
    }

    // Groups
    if (path === '/groups' && method === 'GET') {
      return listGroups(tenantId);
    }
    if (path === '/groups' && method === 'POST') {
      return createGroup(tenantId, event);
    }
    if (path.match(/^\/groups\/[^/]+$/) && method === 'GET') {
      return getGroup(path.split('/')[2]);
    }
    
    // Members
    if (path.match(/^\/groups\/[^/]+\/members$/) && method === 'POST') {
      return addMember(path.split('/')[2], event);
    }
    if (path.match(/^\/groups\/[^/]+\/members\/[^/]+$/) && method === 'DELETE') {
      return removeMember(path.split('/')[2], path.split('/')[4], event);
    }
    
    // Key Updates
    if (path.match(/^\/groups\/[^/]+\/update-key$/) && method === 'POST') {
      return updateKey(path.split('/')[2], event);
    }

    // Messages
    if (path.match(/^\/groups\/[^/]+\/messages$/) && method === 'GET') {
      return getMessages(path.split('/')[2], event);
    }
    if (path.match(/^\/groups\/[^/]+\/messages$/) && method === 'POST') {
      return sendMessage(path.split('/')[2], event);
    }

    // Audit
    if (path === '/audit' && method === 'GET') {
      return getAuditLog(tenantId, event);
    }

    return errorResponse(404, 'Not found');
  } catch (error) {
    logger.error('MLS Admin API error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse(500, 'Internal server error');
  }
};

// ============================================================================
// Dashboard
// ============================================================================

async function getDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  // Get group stats
  const groupsResult = await executeStatement(
    `SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > NOW()) as active
     FROM mls_groups WHERE tenant_id = :tenant_id`,
    [stringParam('tenant_id', tenantId)]
  );

  // Get unique members
  const membersResult = await executeStatement(
    `SELECT COUNT(DISTINCT m.member_id) as count
     FROM mls_group_members m
     JOIN mls_groups g ON g.group_id = m.group_id
     WHERE g.tenant_id = :tenant_id AND m.removed_at IS NULL`,
    [stringParam('tenant_id', tenantId)]
  );

  // Get message stats
  const messagesResult = await executeStatement(
    `SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE msg.sent_at > NOW() - INTERVAL '24 hours') as last_24h
     FROM mls_messages msg
     JOIN mls_groups g ON g.group_id = msg.group_id
     WHERE g.tenant_id = :tenant_id`,
    [stringParam('tenant_id', tenantId)]
  );

  // Get recent groups
  const recentGroupsResult = await executeStatement(
    `SELECT group_id, name, cipher_suite, epoch, created_at, updated_at
     FROM mls_groups WHERE tenant_id = :tenant_id
     ORDER BY created_at DESC LIMIT 10`,
    [stringParam('tenant_id', tenantId)]
  );

  const groupRow = groupsResult.rows?.[0];
  const memberRow = membersResult.rows?.[0];
  const messageRow = messagesResult.rows?.[0];

  return jsonResponse({
    stats: {
      groups: {
        total: parseInt(String(groupRow?.total || 0)),
        active: parseInt(String(groupRow?.active || 0)),
      },
      members: {
        unique: parseInt(String(memberRow?.count || 0)),
      },
      messages: {
        total: parseInt(String(messageRow?.total || 0)),
        last24Hours: parseInt(String(messageRow?.last_24h || 0)),
      },
    },
    recentGroups: recentGroupsResult.rows || [],
  });
}

// ============================================================================
// Key Packages
// ============================================================================

async function createKeyPackage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { memberId, memberType, credential, cipherSuite, validityDays = 90 } = body;

  if (!memberId || !memberType || !credential) {
    return errorResponse(400, 'memberId, memberType, and credential are required');
  }

  const keyPackageId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

  // Note: In production, key generation would use the full MLS service
  // This is a simplified admin view
  await executeStatement(
    `INSERT INTO mls_key_packages (
      key_package_id, member_id, member_type, credential, cipher_suite,
      public_key, signature_key, private_key_encrypted, sig_private_key_encrypted,
      created_at, expires_at
    ) VALUES (
      :key_package_id, :member_id, :member_type, :credential, :cipher_suite,
      :public_key, :signature_key, :private_key, :sig_private_key,
      :created_at, :expires_at
    )`,
    [
      stringParam('key_package_id', keyPackageId),
      stringParam('member_id', memberId),
      stringParam('member_type', memberType),
      stringParam('credential', credential),
      stringParam('cipher_suite', cipherSuite || 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'),
      stringParam('public_key', 'pending-generation'),
      stringParam('signature_key', 'pending-generation'),
      stringParam('private_key', 'pending-generation'),
      stringParam('sig_private_key', 'pending-generation'),
      stringParam('created_at', now.toISOString()),
      stringParam('expires_at', expiresAt.toISOString()),
    ]
  );

  return jsonResponse({ 
    keyPackage: { keyPackageId, memberId, memberType, credential, createdAt: now.toISOString() }
  }, 201);
}

async function getKeyPackage(memberId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT key_package_id, member_id, member_type, credential, cipher_suite, 
            created_at, expires_at
     FROM mls_key_packages 
     WHERE member_id = :member_id AND expires_at > NOW() AND revoked_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [stringParam('member_id', memberId)]
  );
  
  if (!result.rows?.length) {
    return errorResponse(404, 'Key package not found');
  }

  return jsonResponse({ keyPackage: result.rows[0] });
}

// ============================================================================
// Groups
// ============================================================================

async function listGroups(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(
    `SELECT g.group_id, g.name, g.cipher_suite, g.epoch, g.created_at, g.updated_at,
            (SELECT COUNT(*) FROM mls_group_members m 
             WHERE m.group_id = g.group_id AND m.removed_at IS NULL) as member_count
     FROM mls_groups g
     WHERE g.tenant_id = :tenant_id
     ORDER BY g.created_at DESC`,
    [stringParam('tenant_id', tenantId)]
  );

  return jsonResponse({ groups: result.rows || [] });
}

async function createGroup(tenantId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { name, creatorMemberId, cipherSuite, expiresAt } = body;

  if (!name || !creatorMemberId) {
    return errorResponse(400, 'name and creatorMemberId are required');
  }

  const groupId = crypto.randomUUID();
  const now = new Date();

  await executeStatement(
    `INSERT INTO mls_groups (
      group_id, tenant_id, name, cipher_suite, epoch, tree_hash,
      confirmation_key, group_secret_encrypted, created_at, updated_at, expires_at
    ) VALUES (
      :group_id, :tenant_id, :name, :cipher_suite, 0, :tree_hash,
      :confirmation_key, :group_secret, :created_at, :updated_at, :expires_at
    )`,
    [
      stringParam('group_id', groupId),
      stringParam('tenant_id', tenantId),
      stringParam('name', name),
      stringParam('cipher_suite', cipherSuite || 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'),
      stringParam('tree_hash', 'initial'),
      stringParam('confirmation_key', 'pending'),
      stringParam('group_secret', 'pending'),
      stringParam('created_at', now.toISOString()),
      stringParam('updated_at', now.toISOString()),
      stringParam('expires_at', expiresAt || null),
    ]
  );

  // Add creator as first member
  await executeStatement(
    `INSERT INTO mls_group_members (
      group_id, member_id, member_type, key_package_id, public_key,
      leaf_index, added_at, added_by
    ) VALUES (
      :group_id, :member_id, 'user', :key_package_id, :public_key,
      0, :added_at, :added_by
    )`,
    [
      stringParam('group_id', groupId),
      stringParam('member_id', creatorMemberId),
      stringParam('key_package_id', 'pending'),
      stringParam('public_key', 'pending'),
      stringParam('added_at', now.toISOString()),
      stringParam('added_by', creatorMemberId),
    ]
  );

  return jsonResponse({ group: { groupId, name, tenantId, epoch: 0, createdAt: now.toISOString() } }, 201);
}

async function getGroup(groupId: string): Promise<APIGatewayProxyResult> {
  const groupResult = await executeStatement(
    `SELECT * FROM mls_groups WHERE group_id = :group_id`,
    [stringParam('group_id', groupId)]
  );
  
  if (!groupResult.rows?.length) {
    return errorResponse(404, 'Group not found');
  }

  const membersResult = await executeStatement(
    `SELECT member_id, member_type, leaf_index, added_at, added_by
     FROM mls_group_members
     WHERE group_id = :group_id AND removed_at IS NULL
     ORDER BY leaf_index`,
    [stringParam('group_id', groupId)]
  );

  return jsonResponse({ 
    group: groupResult.rows[0],
    members: membersResult.rows || [],
  });
}

// ============================================================================
// Members
// ============================================================================

async function addMember(groupId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { memberId, addedBy } = body;

  if (!memberId || !addedBy) {
    return errorResponse(400, 'memberId and addedBy are required');
  }

  const now = new Date();

  // Get current max leaf index
  const maxLeafResult = await executeStatement(
    `SELECT COALESCE(MAX(leaf_index), -1) + 1 as next_leaf
     FROM mls_group_members WHERE group_id = :group_id`,
    [stringParam('group_id', groupId)]
  );
  const nextLeaf = parseInt(String(maxLeafResult.rows?.[0]?.next_leaf || 0));

  // Add member
  await executeStatement(
    `INSERT INTO mls_group_members (
      group_id, member_id, member_type, key_package_id, public_key,
      leaf_index, added_at, added_by
    ) VALUES (
      :group_id, :member_id, 'user', :key_package_id, :public_key,
      :leaf_index, :added_at, :added_by
    )`,
    [
      stringParam('group_id', groupId),
      stringParam('member_id', memberId),
      stringParam('key_package_id', 'pending'),
      stringParam('public_key', 'pending'),
      longParam('leaf_index', nextLeaf),
      stringParam('added_at', now.toISOString()),
      stringParam('added_by', addedBy),
    ]
  );

  // Increment epoch
  await executeStatement(
    `UPDATE mls_groups SET epoch = epoch + 1, updated_at = :updated_at WHERE group_id = :group_id`,
    [stringParam('updated_at', now.toISOString()), stringParam('group_id', groupId)]
  );

  return jsonResponse({ success: true, memberId, leafIndex: nextLeaf }, 201);
}

async function removeMember(
  groupId: string,
  memberId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { removedBy } = body;

  if (!removedBy) {
    return errorResponse(400, 'removedBy is required');
  }

  const now = new Date();

  await executeStatement(
    `UPDATE mls_group_members 
     SET removed_at = :removed_at, removed_by = :removed_by
     WHERE group_id = :group_id AND member_id = :member_id AND removed_at IS NULL`,
    [
      stringParam('removed_at', now.toISOString()),
      stringParam('removed_by', removedBy),
      stringParam('group_id', groupId),
      stringParam('member_id', memberId),
    ]
  );

  // Increment epoch (critical for post-compromise security)
  await executeStatement(
    `UPDATE mls_groups SET epoch = epoch + 1, updated_at = :updated_at WHERE group_id = :group_id`,
    [stringParam('updated_at', now.toISOString()), stringParam('group_id', groupId)]
  );

  return jsonResponse({ success: true, memberId, removedBy });
}

// ============================================================================
// Key Updates
// ============================================================================

async function updateKey(groupId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { memberId } = body;

  if (!memberId) {
    return errorResponse(400, 'memberId is required');
  }

  const now = new Date();

  // Increment epoch (post-compromise security)
  await executeStatement(
    `UPDATE mls_groups SET epoch = epoch + 1, updated_at = :updated_at WHERE group_id = :group_id`,
    [stringParam('updated_at', now.toISOString()), stringParam('group_id', groupId)]
  );

  // Log the key update
  await executeStatement(
    `INSERT INTO mls_commits (
      group_id, epoch, proposal_type, proposer_id, target_member_id, signature, created_at
    ) SELECT 
      :group_id, epoch, 'update', :proposer_id, :target_member_id, 'admin-update', :created_at
    FROM mls_groups WHERE group_id = :group_id2`,
    [
      stringParam('group_id', groupId),
      stringParam('proposer_id', memberId),
      stringParam('target_member_id', memberId),
      stringParam('created_at', now.toISOString()),
      stringParam('group_id2', groupId),
    ]
  );

  return jsonResponse({ success: true, memberId, message: 'Key update committed' });
}

// ============================================================================
// Messages
// ============================================================================

async function getMessages(groupId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '100');

  const result = await executeStatement(
    `SELECT message_id, sender_id, content_type, epoch, sent_at
     FROM mls_messages
     WHERE group_id = :group_id
     ORDER BY sent_at DESC
     LIMIT :limit`,
    [stringParam('group_id', groupId), longParam('limit', limit)]
  );

  return jsonResponse({ messages: result.rows || [] });
}

async function sendMessage(groupId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { senderId, content } = body;

  if (!senderId || !content) {
    return errorResponse(400, 'senderId and content are required');
  }

  const messageId = crypto.randomUUID();
  const now = new Date();

  // Get current epoch
  const groupResult = await executeStatement(
    `SELECT epoch FROM mls_groups WHERE group_id = :group_id`,
    [stringParam('group_id', groupId)]
  );
  const epoch = parseInt(String(groupResult.rows?.[0]?.epoch || 0));

  // Note: In production, encryption would use the full MLS service
  await executeStatement(
    `INSERT INTO mls_messages (
      message_id, group_id, epoch, sender_id, content_type,
      ciphertext, iv, auth_tag, signature, sent_at
    ) VALUES (
      :message_id, :group_id, :epoch, :sender_id, 'application',
      :ciphertext, :iv, :auth_tag, :signature, :sent_at
    )`,
    [
      stringParam('message_id', messageId),
      stringParam('group_id', groupId),
      longParam('epoch', epoch),
      stringParam('sender_id', senderId),
      stringParam('ciphertext', Buffer.from(content).toString('base64')),
      stringParam('iv', 'admin-api'),
      stringParam('auth_tag', 'admin-api'),
      stringParam('signature', 'admin-api'),
      stringParam('sent_at', now.toISOString()),
    ]
  );

  return jsonResponse({ message: { messageId, groupId, senderId, epoch, sentAt: now.toISOString() } }, 201);
}

// ============================================================================
// Audit
// ============================================================================

async function getAuditLog(tenantId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '100');
  const action = event.queryStringParameters?.action;
  const groupId = event.queryStringParameters?.groupId;

  let sql = `
    SELECT * FROM mls_audit_log 
    WHERE (tenant_id = :tenant_id OR tenant_id IS NULL)
  `;
  const params = [stringParam('tenant_id', tenantId)];

  if (action) {
    sql += ` AND action = :action`;
    params.push(stringParam('action', action));
  }

  if (groupId) {
    sql += ` AND group_id = :group_id`;
    params.push(stringParam('group_id', groupId));
  }

  sql += ` ORDER BY created_at DESC LIMIT :limit`;
  params.push(longParam('limit', limit));

  const result = await executeStatement(sql, params);

  return jsonResponse({
    entries: result.rows || [],
    pagination: { limit, hasMore: (result.rows?.length || 0) === limit },
  });
}

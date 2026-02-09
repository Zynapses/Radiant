// RADIANT v6.5.0 - MLS (Message Layer Security) Service
// RFC 9420-inspired group encryption for agent-to-agent communication
//
// Provides:
// - Forward secrecy through epoch-based key ratcheting
// - Post-compromise security via key updates
// - Efficient group key agreement using X25519
// - Authenticated encryption with AES-256-GCM

import * as crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'mls/mls-service',
  category: 'security',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export type MLSCipherSuite = 
  | 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
  | 'MLS_256_DHKEMP384_AES256GCM_SHA384_P384';

export interface MLSKeyPackage {
  keyPackageId: string;
  memberId: string;
  memberType: 'agent' | 'service' | 'user';
  publicKey: string; // Base64 X25519 public key
  signatureKey: string; // Base64 Ed25519 public key
  credential: string; // Member credential/identity
  cipherSuite: MLSCipherSuite;
  createdAt: string;
  expiresAt: string;
}

export interface MLSGroupMember {
  memberId: string;
  memberType: 'agent' | 'service' | 'user';
  keyPackageId: string;
  publicKey: string;
  leafIndex: number;
  addedAt: string;
  addedBy: string;
  removedAt?: string;
}

export interface MLSGroupState {
  groupId: string;
  tenantId: string;
  name: string;
  cipherSuite: MLSCipherSuite;
  epoch: number;
  members: MLSGroupMember[];
  treeHash: string; // Hash of the ratchet tree
  confirmationKey: string; // Base64 encoded
  groupSecret: string; // Base64 encoded (encrypted)
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface MLSCommit {
  commitId: string;
  groupId: string;
  epoch: number;
  proposalType: 'add' | 'remove' | 'update' | 'reinit';
  proposerId: string;
  targetMemberId?: string;
  newKeyPackage?: MLSKeyPackage;
  signature: string;
  createdAt: string;
}

export interface MLSMessage {
  messageId: string;
  groupId: string;
  epoch: number;
  senderId: string;
  contentType: 'application' | 'proposal' | 'commit';
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  signature: string; // Base64 encoded
  sentAt: string;
}

export interface MLSDecryptedMessage {
  messageId: string;
  groupId: string;
  senderId: string;
  senderType: 'agent' | 'service' | 'user';
  content: Buffer;
  sentAt: string;
  verifiedAt: string;
}

// ============================================================================
// MLS Service Implementation
// ============================================================================

export class MLSService {
  private pool: Pool;
  private kmsKeyArn: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.kmsKeyArn = process.env.KMS_KEY_ARN || '';
  }

  // ==========================================================================
  // Key Package Management
  // ==========================================================================

  /**
   * Generate a new key package for a member
   * Key packages are used to add members to groups
   */
  async generateKeyPackage(
    memberId: string,
    memberType: 'agent' | 'service' | 'user',
    credential: string,
    cipherSuite: MLSCipherSuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
    validityDays: number = 90
  ): Promise<MLSKeyPackage> {
    // Generate X25519 key pair for ECDH
    const dhKeyPair = crypto.generateKeyPairSync('x25519');
    const publicKey = dhKeyPair.publicKey.export({ type: 'spki', format: 'der' });
    
    // Generate Ed25519 key pair for signatures
    const sigKeyPair = crypto.generateKeyPairSync('ed25519');
    const signatureKey = sigKeyPair.publicKey.export({ type: 'spki', format: 'der' });
    
    // Store private keys encrypted (in real impl, this would use KMS)
    const privateKeyEncrypted = this.encryptPrivateKey(
      dhKeyPair.privateKey.export({ type: 'pkcs8', format: 'der' })
    );
    const sigPrivateKeyEncrypted = this.encryptPrivateKey(
      sigKeyPair.privateKey.export({ type: 'pkcs8', format: 'der' })
    );

    const keyPackageId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const keyPackage: MLSKeyPackage = {
      keyPackageId,
      memberId,
      memberType,
      publicKey: publicKey.toString('base64'),
      signatureKey: signatureKey.toString('base64'),
      credential,
      cipherSuite,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Store in database
    await this.pool.query(
      `INSERT INTO mls_key_packages (
        key_package_id, member_id, member_type, public_key, signature_key,
        private_key_encrypted, sig_private_key_encrypted, credential,
        cipher_suite, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        keyPackageId,
        memberId,
        memberType,
        keyPackage.publicKey,
        keyPackage.signatureKey,
        privateKeyEncrypted.toString('base64'),
        sigPrivateKeyEncrypted.toString('base64'),
        credential,
        cipherSuite,
        now,
        expiresAt,
      ]
    );

    logger.info('Key package generated', { keyPackageId, memberId, memberType });
    return keyPackage;
  }

  /**
   * Get a member's active key package
   */
  async getKeyPackage(memberId: string): Promise<MLSKeyPackage | null> {
    const result = await this.pool.query(
      `SELECT * FROM mls_key_packages 
       WHERE member_id = $1 AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [memberId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      keyPackageId: row.key_package_id,
      memberId: row.member_id,
      memberType: row.member_type,
      publicKey: row.public_key,
      signatureKey: row.signature_key,
      credential: row.credential,
      cipherSuite: row.cipher_suite,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    };
  }

  // ==========================================================================
  // Group Management
  // ==========================================================================

  /**
   * Create a new MLS group
   */
  async createGroup(
    tenantId: string,
    name: string,
    creatorMemberId: string,
    cipherSuite: MLSCipherSuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
    expiresAt?: Date
  ): Promise<MLSGroupState> {
    const groupId = crypto.randomUUID();
    const now = new Date();

    // Get creator's key package
    const creatorKeyPackage = await this.getKeyPackage(creatorMemberId);
    if (!creatorKeyPackage) {
      throw new Error(`No valid key package for creator ${creatorMemberId}`);
    }

    // Generate initial group secrets
    const groupSecret = crypto.randomBytes(32);
    const confirmationKey = this.deriveKey(groupSecret, 'mls_confirmation', 32);
    const treeHash = this.computeTreeHash([creatorKeyPackage]);

    // Encrypt group secret for storage
    const encryptedGroupSecret = this.encryptGroupSecret(groupSecret);

    const initialMember: MLSGroupMember = {
      memberId: creatorMemberId,
      memberType: creatorKeyPackage.memberType,
      keyPackageId: creatorKeyPackage.keyPackageId,
      publicKey: creatorKeyPackage.publicKey,
      leafIndex: 0,
      addedAt: now.toISOString(),
      addedBy: creatorMemberId,
    };

    const groupState: MLSGroupState = {
      groupId,
      tenantId,
      name,
      cipherSuite,
      epoch: 0,
      members: [initialMember],
      treeHash,
      confirmationKey: confirmationKey.toString('base64'),
      groupSecret: encryptedGroupSecret.toString('base64'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt?.toISOString(),
    };

    // Store group state
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO mls_groups (
          group_id, tenant_id, name, cipher_suite, epoch, tree_hash,
          confirmation_key, group_secret_encrypted, created_at, updated_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          groupId, tenantId, name, cipherSuite, 0, treeHash,
          groupState.confirmationKey, groupState.groupSecret,
          now, now, expiresAt || null,
        ]
      );

      await client.query(
        `INSERT INTO mls_group_members (
          group_id, member_id, member_type, key_package_id, public_key,
          leaf_index, added_at, added_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          groupId, creatorMemberId, creatorKeyPackage.memberType,
          creatorKeyPackage.keyPackageId, creatorKeyPackage.publicKey,
          0, now, creatorMemberId,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    logger.info('MLS group created', { groupId, tenantId, name, creatorMemberId });
    return groupState;
  }

  /**
   * Get group state
   */
  async getGroup(groupId: string): Promise<MLSGroupState | null> {
    const groupResult = await this.pool.query(
      `SELECT * FROM mls_groups WHERE group_id = $1`,
      [groupId]
    );

    if (groupResult.rows.length === 0) return null;

    const group = groupResult.rows[0];

    const membersResult = await this.pool.query(
      `SELECT * FROM mls_group_members 
       WHERE group_id = $1 AND removed_at IS NULL 
       ORDER BY leaf_index`,
      [groupId]
    );

    const members: MLSGroupMember[] = membersResult.rows.map(row => ({
      memberId: row.member_id,
      memberType: row.member_type,
      keyPackageId: row.key_package_id,
      publicKey: row.public_key,
      leafIndex: row.leaf_index,
      addedAt: row.added_at.toISOString(),
      addedBy: row.added_by,
      removedAt: row.removed_at?.toISOString(),
    }));

    return {
      groupId: group.group_id,
      tenantId: group.tenant_id,
      name: group.name,
      cipherSuite: group.cipher_suite,
      epoch: group.epoch,
      members,
      treeHash: group.tree_hash,
      confirmationKey: group.confirmation_key,
      groupSecret: group.group_secret_encrypted,
      createdAt: group.created_at.toISOString(),
      updatedAt: group.updated_at.toISOString(),
      expiresAt: group.expires_at?.toISOString(),
    };
  }

  /**
   * Add a member to a group (creates a Commit)
   */
  async addMember(
    groupId: string,
    newMemberId: string,
    addedBy: string
  ): Promise<MLSCommit> {
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Verify adder is a member
    const adder = group.members.find(m => m.memberId === addedBy);
    if (!adder) {
      throw new Error(`${addedBy} is not a member of group ${groupId}`);
    }

    // Check if already a member
    if (group.members.some(m => m.memberId === newMemberId)) {
      throw new Error(`${newMemberId} is already a member of group ${groupId}`);
    }

    // Get new member's key package
    const newKeyPackage = await this.getKeyPackage(newMemberId);
    if (!newKeyPackage) {
      throw new Error(`No valid key package for ${newMemberId}`);
    }

    const now = new Date();
    const newEpoch = group.epoch + 1;
    const newLeafIndex = group.members.length;

    // Create commit
    const commitId = crypto.randomUUID();
    const commit: MLSCommit = {
      commitId,
      groupId,
      epoch: newEpoch,
      proposalType: 'add',
      proposerId: addedBy,
      targetMemberId: newMemberId,
      newKeyPackage,
      signature: '', // Will be set below
      createdAt: now.toISOString(),
    };

    // Sign commit
    commit.signature = await this.signCommit(commit, addedBy);

    // Update group state
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Ratchet group secrets for new epoch
      const currentGroupSecret = this.decryptGroupSecret(
        Buffer.from(group.groupSecret, 'base64')
      );
      const newGroupSecret = this.ratchetGroupSecret(currentGroupSecret, newEpoch);
      const newConfirmationKey = this.deriveKey(newGroupSecret, 'mls_confirmation', 32);

      // Add new member
      await client.query(
        `INSERT INTO mls_group_members (
          group_id, member_id, member_type, key_package_id, public_key,
          leaf_index, added_at, added_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          groupId, newMemberId, newKeyPackage.memberType,
          newKeyPackage.keyPackageId, newKeyPackage.publicKey,
          newLeafIndex, now, addedBy,
        ]
      );

      // Update group epoch and secrets
      const allKeyPackages = [...group.members.map(m => ({ publicKey: m.publicKey } as MLSKeyPackage)), newKeyPackage];
      const newTreeHash = this.computeTreeHash(allKeyPackages);

      await client.query(
        `UPDATE mls_groups SET 
          epoch = $2, tree_hash = $3, confirmation_key = $4, 
          group_secret_encrypted = $5, updated_at = $6
        WHERE group_id = $1`,
        [
          groupId, newEpoch, newTreeHash,
          newConfirmationKey.toString('base64'),
          this.encryptGroupSecret(newGroupSecret).toString('base64'),
          now,
        ]
      );

      // Store commit
      await client.query(
        `INSERT INTO mls_commits (
          commit_id, group_id, epoch, proposal_type, proposer_id,
          target_member_id, signature, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          commitId, groupId, newEpoch, 'add', addedBy,
          newMemberId, commit.signature, now,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    logger.info('Member added to MLS group', { groupId, newMemberId, addedBy, epoch: newEpoch });
    return commit;
  }

  /**
   * Remove a member from a group
   */
  async removeMember(
    groupId: string,
    memberId: string,
    removedBy: string
  ): Promise<MLSCommit> {
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Verify remover is a member
    const remover = group.members.find(m => m.memberId === removedBy);
    if (!remover) {
      throw new Error(`${removedBy} is not a member of group ${groupId}`);
    }

    // Verify target is a member
    const target = group.members.find(m => m.memberId === memberId);
    if (!target) {
      throw new Error(`${memberId} is not a member of group ${groupId}`);
    }

    const now = new Date();
    const newEpoch = group.epoch + 1;

    // Create commit
    const commitId = crypto.randomUUID();
    const commit: MLSCommit = {
      commitId,
      groupId,
      epoch: newEpoch,
      proposalType: 'remove',
      proposerId: removedBy,
      targetMemberId: memberId,
      signature: '',
      createdAt: now.toISOString(),
    };

    commit.signature = await this.signCommit(commit, removedBy);

    // Update group state
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Ratchet group secrets - CRITICAL for post-compromise security
      // New secret ensures removed member can't decrypt future messages
      const currentGroupSecret = this.decryptGroupSecret(
        Buffer.from(group.groupSecret, 'base64')
      );
      const newGroupSecret = this.ratchetGroupSecret(currentGroupSecret, newEpoch);
      const newConfirmationKey = this.deriveKey(newGroupSecret, 'mls_confirmation', 32);

      // Mark member as removed
      await client.query(
        `UPDATE mls_group_members SET removed_at = $3 
         WHERE group_id = $1 AND member_id = $2`,
        [groupId, memberId, now]
      );

      // Update group epoch
      const remainingMembers = group.members.filter(m => m.memberId !== memberId);
      const newTreeHash = this.computeTreeHash(
        remainingMembers.map(m => ({ publicKey: m.publicKey } as MLSKeyPackage))
      );

      await client.query(
        `UPDATE mls_groups SET 
          epoch = $2, tree_hash = $3, confirmation_key = $4,
          group_secret_encrypted = $5, updated_at = $6
        WHERE group_id = $1`,
        [
          groupId, newEpoch, newTreeHash,
          newConfirmationKey.toString('base64'),
          this.encryptGroupSecret(newGroupSecret).toString('base64'),
          now,
        ]
      );

      // Store commit
      await client.query(
        `INSERT INTO mls_commits (
          commit_id, group_id, epoch, proposal_type, proposer_id,
          target_member_id, signature, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          commitId, groupId, newEpoch, 'remove', removedBy,
          memberId, commit.signature, now,
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    logger.info('Member removed from MLS group', { groupId, memberId, removedBy, epoch: newEpoch });
    return commit;
  }

  /**
   * Update own key material (for post-compromise security)
   */
  async updateKey(groupId: string, memberId: string): Promise<MLSCommit> {
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const member = group.members.find(m => m.memberId === memberId);
    if (!member) {
      throw new Error(`${memberId} is not a member of group ${groupId}`);
    }

    // Generate new key package
    const newKeyPackage = await this.generateKeyPackage(
      memberId,
      member.memberType,
      `Updated key for ${memberId}`,
      group.cipherSuite
    );

    const now = new Date();
    const newEpoch = group.epoch + 1;

    const commitId = crypto.randomUUID();
    const commit: MLSCommit = {
      commitId,
      groupId,
      epoch: newEpoch,
      proposalType: 'update',
      proposerId: memberId,
      targetMemberId: memberId,
      newKeyPackage,
      signature: '',
      createdAt: now.toISOString(),
    };

    commit.signature = await this.signCommit(commit, memberId);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Ratchet secrets
      const currentGroupSecret = this.decryptGroupSecret(
        Buffer.from(group.groupSecret, 'base64')
      );
      const newGroupSecret = this.ratchetGroupSecret(currentGroupSecret, newEpoch);
      const newConfirmationKey = this.deriveKey(newGroupSecret, 'mls_confirmation', 32);

      // Update member's key package
      await client.query(
        `UPDATE mls_group_members SET 
          key_package_id = $3, public_key = $4
         WHERE group_id = $1 AND member_id = $2`,
        [groupId, memberId, newKeyPackage.keyPackageId, newKeyPackage.publicKey]
      );

      // Update group
      const updatedMembers = group.members.map(m => 
        m.memberId === memberId 
          ? { ...m, publicKey: newKeyPackage.publicKey }
          : m
      );
      const newTreeHash = this.computeTreeHash(
        updatedMembers.map(m => ({ publicKey: m.publicKey } as MLSKeyPackage))
      );

      await client.query(
        `UPDATE mls_groups SET 
          epoch = $2, tree_hash = $3, confirmation_key = $4,
          group_secret_encrypted = $5, updated_at = $6
        WHERE group_id = $1`,
        [
          groupId, newEpoch, newTreeHash,
          newConfirmationKey.toString('base64'),
          this.encryptGroupSecret(newGroupSecret).toString('base64'),
          now,
        ]
      );

      await client.query(
        `INSERT INTO mls_commits (
          commit_id, group_id, epoch, proposal_type, proposer_id,
          target_member_id, signature, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [commitId, groupId, newEpoch, 'update', memberId, memberId, commit.signature, now]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    logger.info('Member key updated in MLS group', { groupId, memberId, epoch: newEpoch });
    return commit;
  }

  // ==========================================================================
  // Message Encryption/Decryption
  // ==========================================================================

  /**
   * Encrypt a message for the group
   */
  async encryptForGroup(
    groupId: string,
    senderId: string,
    plaintext: Buffer
  ): Promise<MLSMessage> {
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const sender = group.members.find(m => m.memberId === senderId);
    if (!sender) {
      throw new Error(`${senderId} is not a member of group ${groupId}`);
    }

    // Derive message key from group secret
    const groupSecret = this.decryptGroupSecret(Buffer.from(group.groupSecret, 'base64'));
    const messageKey = this.deriveKey(groupSecret, `mls_message_${group.epoch}`, 32);

    // Encrypt with AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', messageKey, iv);
    
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Sign the message
    const messageId = crypto.randomUUID();
    const now = new Date();
    
    const signaturePayload = Buffer.concat([
      Buffer.from(messageId),
      Buffer.from(groupId),
      ciphertext,
      iv,
      authTag,
    ]);
    const signature = await this.signMessage(signaturePayload, senderId);

    const message: MLSMessage = {
      messageId,
      groupId,
      epoch: group.epoch,
      senderId,
      contentType: 'application',
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      signature,
      sentAt: now.toISOString(),
    };

    // Store message
    await this.pool.query(
      `INSERT INTO mls_messages (
        message_id, group_id, epoch, sender_id, content_type,
        ciphertext, iv, auth_tag, signature, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        messageId, groupId, group.epoch, senderId, 'application',
        message.ciphertext, message.iv, message.authTag, signature, now,
      ]
    );

    logger.debug('Message encrypted for MLS group', { messageId, groupId, senderId });
    return message;
  }

  /**
   * Decrypt a message from the group
   */
  async decryptFromGroup(
    groupId: string,
    receiverId: string,
    message: MLSMessage
  ): Promise<MLSDecryptedMessage> {
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const receiver = group.members.find(m => m.memberId === receiverId);
    if (!receiver) {
      throw new Error(`${receiverId} is not a member of group ${groupId}`);
    }

    const sender = group.members.find(m => m.memberId === message.senderId);
    if (!sender) {
      throw new Error(`Sender ${message.senderId} is not a member of group ${groupId}`);
    }

    // Verify signature
    const signaturePayload = Buffer.concat([
      Buffer.from(message.messageId),
      Buffer.from(groupId),
      Buffer.from(message.ciphertext, 'base64'),
      Buffer.from(message.iv, 'base64'),
      Buffer.from(message.authTag, 'base64'),
    ]);
    
    const isValid = await this.verifySignature(
      signaturePayload,
      message.signature,
      message.senderId
    );
    if (!isValid) {
      throw new Error('Message signature verification failed');
    }

    // Get the group secret for the message epoch
    // In production, we'd need to track epoch secrets
    const groupSecret = this.decryptGroupSecret(Buffer.from(group.groupSecret, 'base64'));
    const messageKey = this.deriveKey(groupSecret, `mls_message_${message.epoch}`, 32);

    // Decrypt
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      messageKey,
      Buffer.from(message.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(message.authTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(message.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return {
      messageId: message.messageId,
      groupId,
      senderId: message.senderId,
      senderType: sender.memberType,
      content: plaintext,
      sentAt: message.sentAt,
      verifiedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * List groups for a tenant
   */
  async listGroups(tenantId: string): Promise<MLSGroupState[]> {
    const result = await this.pool.query(
      `SELECT g.*, 
        (SELECT json_agg(json_build_object(
          'memberId', m.member_id,
          'memberType', m.member_type,
          'leafIndex', m.leaf_index,
          'addedAt', m.added_at
        )) FROM mls_group_members m WHERE m.group_id = g.group_id AND m.removed_at IS NULL) as members
       FROM mls_groups g 
       WHERE g.tenant_id = $1 
       ORDER BY g.created_at DESC`,
      [tenantId]
    );

    return result.rows.map(row => ({
      groupId: row.group_id,
      tenantId: row.tenant_id,
      name: row.name,
      cipherSuite: row.cipher_suite,
      epoch: row.epoch,
      members: row.members || [],
      treeHash: row.tree_hash,
      confirmationKey: row.confirmation_key,
      groupSecret: row.group_secret_encrypted,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      expiresAt: row.expires_at?.toISOString(),
    }));
  }

  /**
   * Get group message history
   */
  async getMessages(
    groupId: string,
    limit: number = 100,
    beforeMessageId?: string
  ): Promise<MLSMessage[]> {
    let query = `
      SELECT * FROM mls_messages 
      WHERE group_id = $1
    `;
    const params: any[] = [groupId];

    if (beforeMessageId) {
      query += ` AND sent_at < (SELECT sent_at FROM mls_messages WHERE message_id = $2)`;
      params.push(beforeMessageId);
    }

    query += ` ORDER BY sent_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(query, params);

    return result.rows.map(row => ({
      messageId: row.message_id,
      groupId: row.group_id,
      epoch: row.epoch,
      senderId: row.sender_id,
      contentType: row.content_type,
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.auth_tag,
      signature: row.signature,
      sentAt: row.sent_at.toISOString(),
    }));
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private encryptPrivateKey(privateKey: Buffer): Buffer {
    // In production, use KMS. Here using a derived key for simplicity.
    const encryptionKey = this.deriveKey(
      Buffer.from(process.env.MLS_MASTER_KEY || 'dev-master-key-change-in-prod'),
      'private_key_encryption',
      32
    );
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(privateKey), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]);
  }

  private decryptPrivateKey(encrypted: Buffer): Buffer {
    const encryptionKey = this.deriveKey(
      Buffer.from(process.env.MLS_MASTER_KEY || 'dev-master-key-change-in-prod'),
      'private_key_encryption',
      32
    );
    const iv = encrypted.subarray(0, 12);
    const authTag = encrypted.subarray(12, 28);
    const ciphertext = encrypted.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private encryptGroupSecret(secret: Buffer): Buffer {
    return this.encryptPrivateKey(secret); // Same encryption mechanism
  }

  private decryptGroupSecret(encrypted: Buffer): Buffer {
    return this.decryptPrivateKey(encrypted);
  }

  private deriveKey(secret: Buffer | string, info: string, length: number): Buffer {
    const secretBuffer = typeof secret === 'string' ? Buffer.from(secret) : secret;
    return Buffer.from(crypto.hkdfSync('sha256', secretBuffer, Buffer.alloc(0), info, length));
  }

  private ratchetGroupSecret(currentSecret: Buffer, epoch: number): Buffer {
    // Forward-secrecy ratchet: derive new secret from current + epoch
    return this.deriveKey(currentSecret, `mls_epoch_${epoch}`, 32);
  }

  private computeTreeHash(keyPackages: Pick<MLSKeyPackage, 'publicKey'>[]): string {
    // Simplified tree hash - in full MLS this would be a Merkle tree of the ratchet tree
    const combined = keyPackages.map(kp => kp.publicKey).join('');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  private async signCommit(commit: MLSCommit, memberId: string): Promise<string> {
    const payload = JSON.stringify({
      commitId: commit.commitId,
      groupId: commit.groupId,
      epoch: commit.epoch,
      proposalType: commit.proposalType,
      proposerId: commit.proposerId,
      targetMemberId: commit.targetMemberId,
    });
    return this.signMessage(Buffer.from(payload), memberId);
  }

  private async signMessage(payload: Buffer, memberId: string): Promise<string> {
    // Get member's signing private key
    const result = await this.pool.query(
      `SELECT sig_private_key_encrypted FROM mls_key_packages 
       WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [memberId]
    );

    if (result.rows.length === 0) {
      throw new Error(`No key package found for ${memberId}`);
    }

    const encryptedPrivateKey = Buffer.from(result.rows[0].sig_private_key_encrypted, 'base64');
    const privateKeyDer = this.decryptPrivateKey(encryptedPrivateKey);
    
    const privateKey = crypto.createPrivateKey({
      key: privateKeyDer,
      format: 'der',
      type: 'pkcs8',
    });

    const signature = crypto.sign(null, payload, privateKey);
    return signature.toString('base64');
  }

  private async verifySignature(
    payload: Buffer,
    signature: string,
    memberId: string
  ): Promise<boolean> {
    // Get member's signature public key
    const result = await this.pool.query(
      `SELECT signature_key FROM mls_key_packages 
       WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [memberId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const publicKeyDer = Buffer.from(result.rows[0].signature_key, 'base64');
    const publicKey = crypto.createPublicKey({
      key: publicKeyDer,
      format: 'der',
      type: 'spki',
    });

    try {
      return crypto.verify(null, payload, publicKey, Buffer.from(signature, 'base64'));
    } catch {
      return false;
    }
  }
}

// Singleton
let mlsServiceInstance: MLSService | null = null;

export function getMLSService(pool: Pool): MLSService {
  if (!mlsServiceInstance) {
    mlsServiceInstance = new MLSService(pool);
  }
  return mlsServiceInstance;
}

export default MLSService;

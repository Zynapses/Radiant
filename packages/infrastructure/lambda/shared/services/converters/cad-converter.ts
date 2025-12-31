// RADIANT v4.18.55 - CAD/3D File Converter
// Handles mechanical engineering formats: STEP, STL, OBJ, Fusion 360, IGES, DXF, GLTF

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';

export interface CadConversionResult {
  success: boolean;
  text: string;
  metadata: CadMetadata;
  previewUrl?: string;
  error?: string;
}

export interface CadMetadata {
  format: string;
  fileSize: number;
  // Geometry info
  vertexCount?: number;
  faceCount?: number;
  triangleCount?: number;
  // Bounding box
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
  };
  // STL specific
  volume?: number;
  surfaceArea?: number;
  watertight?: boolean;
  // STEP specific
  entityCount?: number;
  assemblyParts?: string[];
  // General
  units?: string;
  layerCount?: number;
  materialCount?: number;
}

export interface CadConversionOptions {
  extractGeometry?: boolean;
  generatePreview?: boolean;
  calculateVolume?: boolean;
  useAiDescription?: boolean;
  targetFormat?: 'text' | 'json' | 'stl' | 'obj';
}

// ============================================================================
// STL Converter
// ============================================================================

/**
 * Parse and analyze STL file
 * STL files can be ASCII or binary
 */
export async function convertStl(
  buffer: Buffer,
  filename: string,
  options: CadConversionOptions = {}
): Promise<CadConversionResult> {
  try {
    const isAscii = isAsciiStl(buffer);
    let metadata: CadMetadata;
    let description: string;

    if (isAscii) {
      const result = parseAsciiStl(buffer.toString('utf-8'));
      metadata = result.metadata;
      description = result.description;
    } else {
      const result = parseBinaryStl(buffer);
      metadata = result.metadata;
      description = result.description;
    }

    metadata.format = 'stl';
    metadata.fileSize = buffer.length;

    // Generate text description
    const text = generateStlDescription(filename, metadata, description);

    return {
      success: true,
      text,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      metadata: { format: 'stl', fileSize: buffer.length },
      error: `STL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if STL is ASCII format
 */
function isAsciiStl(buffer: Buffer): boolean {
  const header = buffer.slice(0, 80).toString('utf-8').toLowerCase();
  return header.startsWith('solid') && !header.includes('\0');
}

/**
 * Parse ASCII STL file
 */
function parseAsciiStl(content: string): { metadata: CadMetadata; description: string } {
  const lines = content.split('\n');
  let triangleCount = 0;
  let solidName = '';
  const vertices: number[][] = [];
  const normals: number[][] = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    
    if (trimmed.startsWith('solid ')) {
      solidName = line.trim().substring(6).trim();
    } else if (trimmed.startsWith('facet normal')) {
      triangleCount++;
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 5) {
        normals.push([parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])]);
      }
    } else if (trimmed.startsWith('vertex')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        vertices.push([x, y, z]);
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
      }
    }
  }

  const metadata: CadMetadata = {
    format: 'stl',
    fileSize: content.length,
    triangleCount,
    vertexCount: vertices.length,
    boundingBox: triangleCount > 0 ? {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      dimensions: {
        width: maxX - minX,
        height: maxY - minY,
        depth: maxZ - minZ,
      },
    } : undefined,
  };

  const description = solidName || 'Unnamed STL model';

  return { metadata, description };
}

/**
 * Parse Binary STL file
 */
function parseBinaryStl(buffer: Buffer): { metadata: CadMetadata; description: string } {
  // Binary STL format:
  // 80 bytes: header
  // 4 bytes: number of triangles (uint32)
  // For each triangle:
  //   12 bytes: normal vector (3 x float32)
  //   36 bytes: vertices (3 x 3 x float32)
  //   2 bytes: attribute byte count (usually 0)

  const header = buffer.slice(0, 80).toString('utf-8').replace(/\0/g, '').trim();
  const triangleCount = buffer.readUInt32LE(80);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  let offset = 84;
  for (let i = 0; i < triangleCount && offset + 50 <= buffer.length; i++) {
    // Skip normal (12 bytes)
    offset += 12;

    // Read 3 vertices
    for (let v = 0; v < 3; v++) {
      const x = buffer.readFloatLE(offset);
      const y = buffer.readFloatLE(offset + 4);
      const z = buffer.readFloatLE(offset + 8);
      offset += 12;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    // Skip attribute byte count (2 bytes)
    offset += 2;
  }

  const metadata: CadMetadata = {
    format: 'stl',
    fileSize: buffer.length,
    triangleCount,
    vertexCount: triangleCount * 3,
    boundingBox: triangleCount > 0 ? {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      dimensions: {
        width: maxX - minX,
        height: maxY - minY,
        depth: maxZ - minZ,
      },
    } : undefined,
  };

  return { metadata, description: header || 'Binary STL model' };
}

/**
 * Generate human-readable STL description
 */
function generateStlDescription(filename: string, metadata: CadMetadata, modelName: string): string {
  const parts: string[] = [];

  parts.push(`**3D Model: ${filename}**`);
  parts.push(`Format: STL (Stereolithography)`);
  parts.push(`Model Name: ${modelName}`);
  parts.push('');

  parts.push('**Geometry:**');
  parts.push(`- Triangle Count: ${metadata.triangleCount?.toLocaleString() || 'Unknown'}`);
  parts.push(`- Vertex Count: ${metadata.vertexCount?.toLocaleString() || 'Unknown'}`);
  parts.push(`- File Size: ${formatFileSize(metadata.fileSize)}`);
  parts.push('');

  if (metadata.boundingBox) {
    const bb = metadata.boundingBox;
    parts.push('**Bounding Box:**');
    parts.push(`- Width (X): ${bb.dimensions.width.toFixed(3)} units`);
    parts.push(`- Height (Y): ${bb.dimensions.height.toFixed(3)} units`);
    parts.push(`- Depth (Z): ${bb.dimensions.depth.toFixed(3)} units`);
    parts.push(`- Min: (${bb.min.x.toFixed(3)}, ${bb.min.y.toFixed(3)}, ${bb.min.z.toFixed(3)})`);
    parts.push(`- Max: (${bb.max.x.toFixed(3)}, ${bb.max.y.toFixed(3)}, ${bb.max.z.toFixed(3)})`);
    parts.push('');
  }

  // Add 3D printing assessment
  if (metadata.triangleCount) {
    parts.push('**3D Printing Assessment:**');
    if (metadata.triangleCount < 1000) {
      parts.push('- Low polygon model - may appear faceted when printed');
    } else if (metadata.triangleCount > 500000) {
      parts.push('- High polygon model - may require mesh simplification for some printers');
    } else {
      parts.push('- Polygon count is suitable for most 3D printing applications');
    }
  }

  return parts.join('\n');
}

// ============================================================================
// OBJ Converter
// ============================================================================

/**
 * Parse and analyze OBJ file
 */
export async function convertObj(
  buffer: Buffer,
  filename: string,
  options: CadConversionOptions = {}
): Promise<CadConversionResult> {
  try {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n');

    let vertexCount = 0;
    let faceCount = 0;
    let normalCount = 0;
    let texCoordCount = 0;
    const materials: Set<string> = new Set();
    const groups: Set<string> = new Set();
    const objects: Set<string> = new Set();

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split(/\s+/);
      const type = parts[0];

      switch (type) {
        case 'v': // Vertex
          vertexCount++;
          if (parts.length >= 4) {
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
          }
          break;
        case 'f': // Face
          faceCount++;
          break;
        case 'vn': // Normal
          normalCount++;
          break;
        case 'vt': // Texture coordinate
          texCoordCount++;
          break;
        case 'usemtl': // Material
          if (parts[1]) materials.add(parts[1]);
          break;
        case 'g': // Group
          if (parts[1]) groups.add(parts[1]);
          break;
        case 'o': // Object
          if (parts[1]) objects.add(parts[1]);
          break;
      }
    }

    const metadata: CadMetadata = {
      format: 'obj',
      fileSize: buffer.length,
      vertexCount,
      faceCount,
      materialCount: materials.size,
      boundingBox: vertexCount > 0 ? {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        dimensions: {
          width: maxX - minX,
          height: maxY - minY,
          depth: maxZ - minZ,
        },
      } : undefined,
    };

    // Generate description
    const text = generateObjDescription(filename, metadata, {
      normalCount,
      texCoordCount,
      materials: Array.from(materials),
      groups: Array.from(groups),
      objects: Array.from(objects),
    });

    return {
      success: true,
      text,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      metadata: { format: 'obj', fileSize: buffer.length },
      error: `OBJ parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate human-readable OBJ description
 */
function generateObjDescription(
  filename: string,
  metadata: CadMetadata,
  extra: {
    normalCount: number;
    texCoordCount: number;
    materials: string[];
    groups: string[];
    objects: string[];
  }
): string {
  const parts: string[] = [];

  parts.push(`**3D Model: ${filename}**`);
  parts.push(`Format: Wavefront OBJ`);
  parts.push('');

  parts.push('**Geometry:**');
  parts.push(`- Vertices: ${metadata.vertexCount?.toLocaleString() || 'Unknown'}`);
  parts.push(`- Faces: ${metadata.faceCount?.toLocaleString() || 'Unknown'}`);
  parts.push(`- Normals: ${extra.normalCount.toLocaleString()}`);
  parts.push(`- Texture Coords: ${extra.texCoordCount.toLocaleString()}`);
  parts.push(`- File Size: ${formatFileSize(metadata.fileSize)}`);
  parts.push('');

  if (extra.objects.length > 0) {
    parts.push('**Objects:**');
    extra.objects.forEach(obj => parts.push(`- ${obj}`));
    parts.push('');
  }

  if (extra.groups.length > 0) {
    parts.push('**Groups:**');
    extra.groups.slice(0, 10).forEach(g => parts.push(`- ${g}`));
    if (extra.groups.length > 10) {
      parts.push(`- ... and ${extra.groups.length - 10} more`);
    }
    parts.push('');
  }

  if (extra.materials.length > 0) {
    parts.push('**Materials:**');
    extra.materials.slice(0, 10).forEach(m => parts.push(`- ${m}`));
    if (extra.materials.length > 10) {
      parts.push(`- ... and ${extra.materials.length - 10} more`);
    }
    parts.push('');
  }

  if (metadata.boundingBox) {
    const bb = metadata.boundingBox;
    parts.push('**Bounding Box:**');
    parts.push(`- Dimensions: ${bb.dimensions.width.toFixed(3)} x ${bb.dimensions.height.toFixed(3)} x ${bb.dimensions.depth.toFixed(3)} units`);
  }

  return parts.join('\n');
}

// ============================================================================
// STEP/IGES Parser (Basic - extracts metadata from text sections)
// ============================================================================

/**
 * Parse STEP file and extract metadata
 * Full STEP parsing requires OpenCASCADE, but we can extract useful info from text
 */
export async function convertStep(
  buffer: Buffer,
  filename: string,
  options: CadConversionOptions = {}
): Promise<CadConversionResult> {
  try {
    const content = buffer.toString('utf-8');
    
    // STEP files have a HEADER and DATA section
    const headerMatch = content.match(/HEADER;([\s\S]*?)ENDSEC;/);
    const dataSection = content.match(/DATA;([\s\S]*?)ENDSEC;/);

    // Extract file description from header
    let fileDescription = '';
    let fileName = '';
    let author = '';
    let organization = '';
    let schema = '';

    if (headerMatch) {
      const header = headerMatch[1];
      
      const descMatch = header.match(/FILE_DESCRIPTION\s*\(\s*\(\s*'([^']*)'/);
      if (descMatch) fileDescription = descMatch[1];

      const nameMatch = header.match(/FILE_NAME\s*\(\s*'([^']*)'/);
      if (nameMatch) fileName = nameMatch[1];

      const authorMatch = header.match(/FILE_NAME[^)]*\)\s*,\s*'[^']*'\s*,\s*\(\s*'([^']*)'/);
      if (authorMatch) author = authorMatch[1];

      const schemaMatch = header.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/);
      if (schemaMatch) schema = schemaMatch[1];
    }

    // Count entities in DATA section
    let entityCount = 0;
    const entityTypes: Map<string, number> = new Map();
    const partNames: string[] = [];

    if (dataSection) {
      const data = dataSection[1];
      const entityMatches = data.matchAll(/#\d+\s*=\s*(\w+)\s*\(/g);
      
      for (const match of entityMatches) {
        entityCount++;
        const type = match[1];
        entityTypes.set(type, (entityTypes.get(type) || 0) + 1);

        // Look for product names
        if (type === 'PRODUCT' || type === 'PRODUCT_DEFINITION') {
          const productMatch = data.slice(match.index || 0, (match.index || 0) + 500)
            .match(/PRODUCT\s*\(\s*'([^']*)'/);
          if (productMatch && productMatch[1]) {
            partNames.push(productMatch[1]);
          }
        }
      }
    }

    const metadata: CadMetadata = {
      format: 'step',
      fileSize: buffer.length,
      entityCount,
      assemblyParts: partNames.slice(0, 20),
    };

    // Generate description
    const text = generateStepDescription(filename, metadata, {
      fileDescription,
      fileName,
      author,
      organization,
      schema,
      entityTypes: Object.fromEntries(
        Array.from(entityTypes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
      ),
    });

    return {
      success: true,
      text,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      metadata: { format: 'step', fileSize: buffer.length },
      error: `STEP parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate human-readable STEP description
 */
function generateStepDescription(
  filename: string,
  metadata: CadMetadata,
  extra: {
    fileDescription: string;
    fileName: string;
    author: string;
    organization: string;
    schema: string;
    entityTypes: Record<string, number>;
  }
): string {
  const parts: string[] = [];

  parts.push(`**CAD Model: ${filename}**`);
  parts.push(`Format: STEP (ISO 10303)`);
  if (extra.schema) parts.push(`Schema: ${extra.schema}`);
  parts.push('');

  if (extra.fileDescription) {
    parts.push(`**Description:** ${extra.fileDescription}`);
    parts.push('');
  }

  parts.push('**File Information:**');
  parts.push(`- File Size: ${formatFileSize(metadata.fileSize)}`);
  parts.push(`- Entity Count: ${metadata.entityCount?.toLocaleString() || 'Unknown'}`);
  if (extra.author) parts.push(`- Author: ${extra.author}`);
  parts.push('');

  if (metadata.assemblyParts && metadata.assemblyParts.length > 0) {
    parts.push('**Parts/Components:**');
    metadata.assemblyParts.forEach(part => parts.push(`- ${part}`));
    parts.push('');
  }

  // Show entity type breakdown
  const entityEntries = Object.entries(extra.entityTypes);
  if (entityEntries.length > 0) {
    parts.push('**Entity Types:**');
    entityEntries.forEach(([type, count]) => {
      parts.push(`- ${type}: ${count.toLocaleString()}`);
    });
    parts.push('');
  }

  parts.push('**Note:** Full geometry analysis requires OpenCASCADE or similar library.');
  parts.push('For detailed CAD operations, export to STL or use native CAD software.');

  return parts.join('\n');
}

// ============================================================================
// DXF Parser (2D CAD)
// ============================================================================

/**
 * Parse DXF file and extract layer/entity information
 */
export async function convertDxf(
  buffer: Buffer,
  filename: string,
  options: CadConversionOptions = {}
): Promise<CadConversionResult> {
  try {
    const content = buffer.toString('utf-8');
    
    // DXF is organized in sections
    const layers: Set<string> = new Set();
    const entityTypes: Map<string, number> = new Map();
    let blockCount = 0;

    // Extract layers from TABLES section
    const layerMatches = content.matchAll(/AcDbLayerTableRecord\s*\n\s*2\s*\n\s*(\S+)/g);
    for (const match of layerMatches) {
      if (match[1] && match[1] !== '0') {
        layers.add(match[1]);
      }
    }

    // Count entities
    const entityMatches = content.matchAll(/\n\s*0\s*\n\s*(LINE|CIRCLE|ARC|POLYLINE|LWPOLYLINE|TEXT|MTEXT|DIMENSION|INSERT|SOLID|HATCH|SPLINE|ELLIPSE)\s*\n/gi);
    for (const match of entityMatches) {
      const type = match[1].toUpperCase();
      entityTypes.set(type, (entityTypes.get(type) || 0) + 1);
    }

    // Count blocks
    const blockMatches = content.match(/\n\s*0\s*\n\s*BLOCK\s*\n/gi);
    blockCount = blockMatches?.length || 0;

    const totalEntities = Array.from(entityTypes.values()).reduce((a, b) => a + b, 0);

    const metadata: CadMetadata = {
      format: 'dxf',
      fileSize: buffer.length,
      layerCount: layers.size,
      entityCount: totalEntities,
    };

    // Generate description
    const text = generateDxfDescription(filename, metadata, {
      layers: Array.from(layers),
      entityTypes: Object.fromEntries(entityTypes),
      blockCount,
    });

    return {
      success: true,
      text,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      metadata: { format: 'dxf', fileSize: buffer.length },
      error: `DXF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate human-readable DXF description
 */
function generateDxfDescription(
  filename: string,
  metadata: CadMetadata,
  extra: {
    layers: string[];
    entityTypes: Record<string, number>;
    blockCount: number;
  }
): string {
  const parts: string[] = [];

  parts.push(`**2D CAD Drawing: ${filename}**`);
  parts.push(`Format: DXF (AutoCAD Drawing Exchange)`);
  parts.push('');

  parts.push('**Drawing Information:**');
  parts.push(`- File Size: ${formatFileSize(metadata.fileSize)}`);
  parts.push(`- Layer Count: ${extra.layers.length}`);
  parts.push(`- Entity Count: ${metadata.entityCount?.toLocaleString() || 'Unknown'}`);
  parts.push(`- Block Count: ${extra.blockCount}`);
  parts.push('');

  if (extra.layers.length > 0) {
    parts.push('**Layers:**');
    extra.layers.slice(0, 15).forEach(layer => parts.push(`- ${layer}`));
    if (extra.layers.length > 15) {
      parts.push(`- ... and ${extra.layers.length - 15} more`);
    }
    parts.push('');
  }

  const entityEntries = Object.entries(extra.entityTypes);
  if (entityEntries.length > 0) {
    parts.push('**Entity Types:**');
    entityEntries
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        parts.push(`- ${type}: ${count.toLocaleString()}`);
      });
  }

  return parts.join('\n');
}

// ============================================================================
// GLTF/GLB Parser
// ============================================================================

/**
 * Parse GLTF/GLB 3D model
 */
export async function convertGltf(
  buffer: Buffer,
  filename: string,
  options: CadConversionOptions = {}
): Promise<CadConversionResult> {
  try {
    const isGlb = filename.toLowerCase().endsWith('.glb');
    let gltfJson: any;

    if (isGlb) {
      // GLB is binary format with embedded JSON
      // Header: magic (4 bytes) + version (4 bytes) + length (4 bytes)
      // Then chunks: length (4 bytes) + type (4 bytes) + data
      const magic = buffer.readUInt32LE(0);
      if (magic !== 0x46546C67) { // 'glTF' in little endian
        throw new Error('Invalid GLB magic number');
      }

      const jsonChunkLength = buffer.readUInt32LE(12);
      const jsonChunkType = buffer.readUInt32LE(16);
      if (jsonChunkType !== 0x4E4F534A) { // 'JSON' in little endian
        throw new Error('First chunk is not JSON');
      }

      const jsonData = buffer.slice(20, 20 + jsonChunkLength).toString('utf-8');
      gltfJson = JSON.parse(jsonData);
    } else {
      // Regular JSON GLTF
      gltfJson = JSON.parse(buffer.toString('utf-8'));
    }

    // Extract metadata from GLTF structure
    const meshCount = gltfJson.meshes?.length || 0;
    const nodeCount = gltfJson.nodes?.length || 0;
    const materialCount = gltfJson.materials?.length || 0;
    const textureCount = gltfJson.textures?.length || 0;
    const animationCount = gltfJson.animations?.length || 0;

    // Count primitives and vertices
    let primitiveCount = 0;
    let estimatedVertices = 0;
    
    for (const mesh of gltfJson.meshes || []) {
      primitiveCount += mesh.primitives?.length || 0;
    }

    const metadata: CadMetadata = {
      format: isGlb ? 'glb' : 'gltf',
      fileSize: buffer.length,
      materialCount,
    };

    // Generate description
    const text = generateGltfDescription(filename, metadata, {
      asset: gltfJson.asset,
      meshCount,
      nodeCount,
      materialCount,
      textureCount,
      animationCount,
      primitiveCount,
      scenes: gltfJson.scenes?.map((s: any) => s.name).filter(Boolean) || [],
    });

    return {
      success: true,
      text,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      metadata: { format: 'gltf', fileSize: buffer.length },
      error: `GLTF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate human-readable GLTF description
 */
function generateGltfDescription(
  filename: string,
  metadata: CadMetadata,
  extra: {
    asset: { version?: string; generator?: string; copyright?: string };
    meshCount: number;
    nodeCount: number;
    materialCount: number;
    textureCount: number;
    animationCount: number;
    primitiveCount: number;
    scenes: string[];
  }
): string {
  const parts: string[] = [];

  parts.push(`**3D Model: ${filename}**`);
  parts.push(`Format: glTF ${extra.asset?.version || '2.0'}`);
  if (extra.asset?.generator) parts.push(`Generator: ${extra.asset.generator}`);
  parts.push('');

  parts.push('**Scene Information:**');
  parts.push(`- File Size: ${formatFileSize(metadata.fileSize)}`);
  parts.push(`- Meshes: ${extra.meshCount}`);
  parts.push(`- Nodes: ${extra.nodeCount}`);
  parts.push(`- Primitives: ${extra.primitiveCount}`);
  parts.push(`- Materials: ${extra.materialCount}`);
  parts.push(`- Textures: ${extra.textureCount}`);
  if (extra.animationCount > 0) {
    parts.push(`- Animations: ${extra.animationCount}`);
  }
  parts.push('');

  if (extra.scenes.length > 0) {
    parts.push('**Scenes:**');
    extra.scenes.forEach(scene => parts.push(`- ${scene}`));
  }

  return parts.join('\n');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Detect CAD format from buffer
 */
export function detectCadFormat(buffer: Buffer, filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  
  // Check by extension first
  const extMap: Record<string, string> = {
    '.stl': 'stl',
    '.obj': 'obj',
    '.step': 'step',
    '.stp': 'step',
    '.p21': 'step',
    '.iges': 'iges',
    '.igs': 'iges',
    '.dxf': 'dxf',
    '.gltf': 'gltf',
    '.glb': 'glb',
    '.f3d': 'fusion360',
    '.f3z': 'fusion360',
  };

  if (extMap[ext]) {
    return extMap[ext];
  }

  // Check by magic bytes
  const header = buffer.slice(0, 20).toString('utf-8').toLowerCase();
  
  if (header.startsWith('solid') || header.startsWith('solid ')) {
    return 'stl'; // ASCII STL
  }
  
  if (buffer.readUInt32LE(0) === 0x46546C67) {
    return 'glb'; // GLB magic number
  }

  // STEP files start with ISO-10303
  if (header.includes('iso-10303')) {
    return 'step';
  }

  return null;
}

/**
 * Main CAD conversion entry point
 */
export async function convertCadFile(
  buffer: Buffer,
  filename: string,
  options: CadConversionOptions = {}
): Promise<CadConversionResult> {
  const format = detectCadFormat(buffer, filename);

  switch (format) {
    case 'stl':
      return convertStl(buffer, filename, options);
    case 'obj':
      return convertObj(buffer, filename, options);
    case 'step':
      return convertStep(buffer, filename, options);
    case 'dxf':
      return convertDxf(buffer, filename, options);
    case 'gltf':
    case 'glb':
      return convertGltf(buffer, filename, options);
    case 'fusion360':
      return {
        success: true,
        text: `**Fusion 360 File: ${filename}**\n\nThis is an Autodesk Fusion 360 native file. To extract geometry, please export to STEP or STL format using Fusion 360.`,
        metadata: { format: 'fusion360', fileSize: buffer.length },
      };
    default:
      return {
        success: false,
        text: '',
        metadata: { format: 'unknown', fileSize: buffer.length },
        error: `Unknown CAD format: ${filename}`,
      };
  }
}

/**
 * Estimate tokens for CAD description
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

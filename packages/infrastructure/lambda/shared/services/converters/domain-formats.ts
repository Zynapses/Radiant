// RADIANT v4.18.55 - Domain-Specific File Format Registry
// AGI Brain uses this to select appropriate conversion libraries for specialized file types

export interface DomainFormat {
  format: string;
  extensions: string[];
  mimeTypes: string[];
  domain: DomainCategory;
  subDomain?: string;
  description: string;
  conversionStrategies: ConversionStrategy[];
  recommendedLibraries: LibraryRecommendation[];
  aiDescriptionPrompt?: string;
  complexity: 'simple' | 'moderate' | 'complex';
  binaryFormat: boolean;
}

export interface LibraryRecommendation {
  name: string;
  npmPackage?: string;
  pythonPackage?: string;
  systemBinary?: string;
  capabilities: string[];
  outputFormats: string[];
  notes?: string;
  priority: number;  // 1 = highest priority
}

export interface ConversionStrategy {
  strategy: string;
  outputFormat: string;
  preserves: string[];  // What information is preserved
  loses: string[];      // What information is lost
}

export type DomainCategory =
  | 'mechanical_engineering'
  | 'electrical_engineering'
  | 'architecture'
  | 'medical'
  | 'scientific'
  | 'legal'
  | 'financial'
  | 'geospatial'
  | 'audio_production'
  | 'video_production'
  | 'game_development'
  | 'data_science'
  | 'bioinformatics';

// ============================================================================
// MECHANICAL ENGINEERING & CAD FORMATS
// ============================================================================

export const MECHANICAL_ENGINEERING_FORMATS: DomainFormat[] = [
  // STEP - Standard for the Exchange of Product Data
  {
    format: 'step',
    extensions: ['.step', '.stp', '.p21'],
    mimeTypes: ['application/step', 'model/step'],
    domain: 'mechanical_engineering',
    subDomain: 'CAD Exchange',
    description: 'ISO 10303 STEP file - Industry standard for CAD data exchange between different systems',
    conversionStrategies: [
      {
        strategy: 'extract_geometry',
        outputFormat: 'text',
        preserves: ['geometry', 'topology', 'assembly structure', 'part names'],
        loses: ['visual appearance', 'manufacturing data', 'PMI'],
      },
      {
        strategy: 'convert_to_stl',
        outputFormat: 'stl',
        preserves: ['surface mesh', 'geometry'],
        loses: ['parametric data', 'assembly info', 'metadata'],
      },
      {
        strategy: 'ai_describe',
        outputFormat: 'text',
        preserves: ['conceptual understanding'],
        loses: ['precise dimensions', 'technical specs'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'OpenCASCADE',
        pythonPackage: 'OCC',
        systemBinary: 'OCCT',
        capabilities: ['parse', 'convert', 'analyze', 'mesh'],
        outputFormats: ['stl', 'obj', 'iges', 'brep'],
        priority: 1,
      },
      {
        name: 'FreeCAD',
        pythonPackage: 'freecad',
        systemBinary: 'freecadcmd',
        capabilities: ['parse', 'convert', 'render'],
        outputFormats: ['stl', 'obj', 'dxf', 'svg'],
        priority: 2,
      },
      {
        name: 'cadquery',
        pythonPackage: 'cadquery',
        capabilities: ['parse', 'analyze'],
        outputFormats: ['stl', 'svg'],
        priority: 3,
      },
    ],
    aiDescriptionPrompt: 'This is a STEP CAD file. Describe the mechanical part or assembly, including approximate geometry, features (holes, fillets, chamfers), and likely manufacturing process.',
    complexity: 'complex',
    binaryFormat: false,
  },

  // STL - Stereolithography
  {
    format: 'stl',
    extensions: ['.stl'],
    mimeTypes: ['model/stl', 'application/sla', 'model/x.stl-binary', 'model/x.stl-ascii'],
    domain: 'mechanical_engineering',
    subDomain: '3D Printing',
    description: 'Stereolithography file format - Standard for 3D printing and rapid prototyping',
    conversionStrategies: [
      {
        strategy: 'extract_mesh_info',
        outputFormat: 'text',
        preserves: ['triangle count', 'bounding box', 'volume estimate'],
        loses: ['color', 'texture', 'units'],
      },
      {
        strategy: 'render_preview',
        outputFormat: 'image',
        preserves: ['visual appearance', 'geometry'],
        loses: ['precise dimensions'],
      },
      {
        strategy: 'ai_describe',
        outputFormat: 'text',
        preserves: ['shape description', 'printability assessment'],
        loses: ['precise measurements'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'numpy-stl',
        pythonPackage: 'numpy-stl',
        capabilities: ['parse', 'analyze', 'modify'],
        outputFormats: ['stl', 'obj'],
        priority: 1,
      },
      {
        name: 'trimesh',
        pythonPackage: 'trimesh',
        capabilities: ['parse', 'analyze', 'render', 'boolean ops'],
        outputFormats: ['stl', 'obj', 'ply', 'glb'],
        priority: 1,
      },
      {
        name: 'three.js STLLoader',
        npmPackage: 'three',
        capabilities: ['parse', 'render'],
        outputFormats: ['json', 'image'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is an STL 3D model file. Describe the shape, identify what object it might be, assess printability, and note any potential issues for 3D printing.',
    complexity: 'moderate',
    binaryFormat: true,
  },

  // OBJ - Wavefront
  {
    format: 'obj',
    extensions: ['.obj'],
    mimeTypes: ['model/obj', 'text/plain'],
    domain: 'mechanical_engineering',
    subDomain: '3D Modeling',
    description: 'Wavefront OBJ file - Common 3D model format with optional materials',
    conversionStrategies: [
      {
        strategy: 'extract_mesh_info',
        outputFormat: 'text',
        preserves: ['vertex count', 'face count', 'material refs'],
        loses: ['textures'],
      },
      {
        strategy: 'render_preview',
        outputFormat: 'image',
        preserves: ['visual appearance'],
        loses: ['interactivity'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'trimesh',
        pythonPackage: 'trimesh',
        capabilities: ['parse', 'analyze', 'render'],
        outputFormats: ['stl', 'obj', 'ply', 'glb'],
        priority: 1,
      },
      {
        name: 'three.js OBJLoader',
        npmPackage: 'three',
        capabilities: ['parse', 'render'],
        outputFormats: ['json', 'image'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is a Wavefront OBJ 3D model. Describe the object, its complexity, and notable features.',
    complexity: 'moderate',
    binaryFormat: false,
  },

  // Fusion 360
  {
    format: 'f3d',
    extensions: ['.f3d', '.f3z'],
    mimeTypes: ['application/x-fusion360'],
    domain: 'mechanical_engineering',
    subDomain: 'Parametric CAD',
    description: 'Autodesk Fusion 360 native format - Parametric CAD with history',
    conversionStrategies: [
      {
        strategy: 'export_via_api',
        outputFormat: 'step',
        preserves: ['geometry', 'assembly'],
        loses: ['history', 'sketches', 'parameters'],
      },
      {
        strategy: 'extract_metadata',
        outputFormat: 'json',
        preserves: ['project info', 'component list'],
        loses: ['geometry'],
      },
      {
        strategy: 'ai_describe',
        outputFormat: 'text',
        preserves: ['conceptual design'],
        loses: ['all technical data'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'Fusion 360 API',
        systemBinary: 'fusion360',
        capabilities: ['export'],
        outputFormats: ['step', 'iges', 'stl', 'obj', 'f3d'],
        notes: 'Requires Fusion 360 installation or cloud API access',
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is a Fusion 360 CAD file. Without access to the native format, describe what you can infer about the design from any extracted metadata or converted geometry.',
    complexity: 'complex',
    binaryFormat: true,
  },

  // IGES
  {
    format: 'iges',
    extensions: ['.iges', '.igs'],
    mimeTypes: ['model/iges', 'application/iges'],
    domain: 'mechanical_engineering',
    subDomain: 'CAD Exchange',
    description: 'Initial Graphics Exchange Specification - Legacy CAD exchange format',
    conversionStrategies: [
      {
        strategy: 'convert_to_step',
        outputFormat: 'step',
        preserves: ['geometry', 'curves', 'surfaces'],
        loses: ['some metadata'],
      },
      {
        strategy: 'extract_geometry',
        outputFormat: 'text',
        preserves: ['entity list', 'structure'],
        loses: ['visual representation'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'OpenCASCADE',
        pythonPackage: 'OCC',
        capabilities: ['parse', 'convert'],
        outputFormats: ['step', 'stl', 'brep'],
        priority: 1,
      },
      {
        name: 'FreeCAD',
        pythonPackage: 'freecad',
        capabilities: ['parse', 'convert'],
        outputFormats: ['step', 'stl'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is an IGES CAD file. Describe the geometric entities and overall structure of the model.',
    complexity: 'complex',
    binaryFormat: false,
  },

  // DXF - AutoCAD Drawing Exchange
  {
    format: 'dxf',
    extensions: ['.dxf'],
    mimeTypes: ['image/vnd.dxf', 'application/dxf'],
    domain: 'mechanical_engineering',
    subDomain: '2D CAD',
    description: 'AutoCAD Drawing Exchange Format - 2D/3D CAD interchange',
    conversionStrategies: [
      {
        strategy: 'convert_to_svg',
        outputFormat: 'svg',
        preserves: ['2D geometry', 'layers', 'colors'],
        loses: ['3D data', 'blocks'],
      },
      {
        strategy: 'extract_entities',
        outputFormat: 'json',
        preserves: ['entity list', 'layers', 'dimensions'],
        loses: ['visual rendering'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'ezdxf',
        pythonPackage: 'ezdxf',
        capabilities: ['parse', 'create', 'modify'],
        outputFormats: ['dxf', 'json'],
        priority: 1,
      },
      {
        name: 'dxf-parser',
        npmPackage: 'dxf-parser',
        capabilities: ['parse'],
        outputFormats: ['json'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is a DXF CAD file. Describe the 2D drawing, including layers, dimensions, and what it represents.',
    complexity: 'moderate',
    binaryFormat: false,
  },

  // GLTF/GLB - 3D Web Standard
  {
    format: 'gltf',
    extensions: ['.gltf', '.glb'],
    mimeTypes: ['model/gltf+json', 'model/gltf-binary'],
    domain: 'mechanical_engineering',
    subDomain: '3D Visualization',
    description: 'GL Transmission Format - Web-optimized 3D format',
    conversionStrategies: [
      {
        strategy: 'render_preview',
        outputFormat: 'image',
        preserves: ['visual appearance', 'materials', 'textures'],
        loses: ['interactivity'],
      },
      {
        strategy: 'extract_scene_info',
        outputFormat: 'json',
        preserves: ['scene graph', 'materials', 'animations'],
        loses: ['rendered appearance'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'three.js GLTFLoader',
        npmPackage: 'three',
        capabilities: ['parse', 'render'],
        outputFormats: ['image', 'json'],
        priority: 1,
      },
      {
        name: 'trimesh',
        pythonPackage: 'trimesh',
        capabilities: ['parse', 'convert'],
        outputFormats: ['stl', 'obj', 'ply'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is a glTF 3D model. Describe the scene, objects, materials, and any animations present.',
    complexity: 'moderate',
    binaryFormat: true,
  },
];

// ============================================================================
// ELECTRICAL ENGINEERING FORMATS
// ============================================================================

export const ELECTRICAL_ENGINEERING_FORMATS: DomainFormat[] = [
  // KiCad
  {
    format: 'kicad_pcb',
    extensions: ['.kicad_pcb', '.kicad_sch', '.kicad_pro'],
    mimeTypes: ['application/x-kicad-pcb'],
    domain: 'electrical_engineering',
    subDomain: 'PCB Design',
    description: 'KiCad PCB and schematic files - Open source EDA',
    conversionStrategies: [
      {
        strategy: 'extract_bom',
        outputFormat: 'csv',
        preserves: ['component list', 'values', 'footprints'],
        loses: ['layout', 'routing'],
      },
      {
        strategy: 'export_gerber',
        outputFormat: 'gerber',
        preserves: ['manufacturing data'],
        loses: ['schematic info'],
      },
      {
        strategy: 'render_svg',
        outputFormat: 'svg',
        preserves: ['visual layout'],
        loses: ['3D info'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'kicad-cli',
        systemBinary: 'kicad-cli',
        capabilities: ['export', 'render'],
        outputFormats: ['svg', 'pdf', 'gerber', 'step'],
        priority: 1,
      },
      {
        name: 'kiutils',
        pythonPackage: 'kiutils',
        capabilities: ['parse', 'modify'],
        outputFormats: ['json'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is a KiCad PCB/schematic file. Describe the circuit, major components, and board characteristics.',
    complexity: 'complex',
    binaryFormat: false,
  },

  // EAGLE
  {
    format: 'eagle',
    extensions: ['.brd', '.sch', '.lbr'],
    mimeTypes: ['application/x-eagle'],
    domain: 'electrical_engineering',
    subDomain: 'PCB Design',
    description: 'Autodesk EAGLE PCB design files',
    conversionStrategies: [
      {
        strategy: 'extract_bom',
        outputFormat: 'csv',
        preserves: ['component list'],
        loses: ['layout'],
      },
      {
        strategy: 'convert_to_kicad',
        outputFormat: 'kicad',
        preserves: ['schematic', 'layout'],
        loses: ['some attributes'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'eagle-to-kicad',
        pythonPackage: 'eagle-to-kicad',
        capabilities: ['convert'],
        outputFormats: ['kicad'],
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is an EAGLE PCB file. Describe the circuit design and board layout.',
    complexity: 'complex',
    binaryFormat: true,
  },

  // SPICE
  {
    format: 'spice',
    extensions: ['.spice', '.sp', '.cir', '.net'],
    mimeTypes: ['text/x-spice'],
    domain: 'electrical_engineering',
    subDomain: 'Circuit Simulation',
    description: 'SPICE circuit simulation netlist',
    conversionStrategies: [
      {
        strategy: 'parse_netlist',
        outputFormat: 'json',
        preserves: ['components', 'connections', 'values'],
        loses: ['simulation results'],
      },
      {
        strategy: 'simulate',
        outputFormat: 'csv',
        preserves: ['waveforms', 'DC operating point'],
        loses: [],
      },
    ],
    recommendedLibraries: [
      {
        name: 'PySpice',
        pythonPackage: 'PySpice',
        capabilities: ['parse', 'simulate'],
        outputFormats: ['json', 'csv'],
        priority: 1,
      },
      {
        name: 'ngspice',
        systemBinary: 'ngspice',
        capabilities: ['simulate'],
        outputFormats: ['csv', 'raw'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is a SPICE netlist. Describe the circuit topology, component values, and expected behavior.',
    complexity: 'moderate',
    binaryFormat: false,
  },
];

// ============================================================================
// MEDICAL/HEALTHCARE FORMATS
// ============================================================================

export const MEDICAL_FORMATS: DomainFormat[] = [
  // DICOM
  {
    format: 'dicom',
    extensions: ['.dcm', '.dicom'],
    mimeTypes: ['application/dicom'],
    domain: 'medical',
    subDomain: 'Medical Imaging',
    description: 'Digital Imaging and Communications in Medicine - Medical image format',
    conversionStrategies: [
      {
        strategy: 'extract_metadata',
        outputFormat: 'json',
        preserves: ['patient info', 'study info', 'modality'],
        loses: ['pixel data'],
      },
      {
        strategy: 'convert_to_png',
        outputFormat: 'png',
        preserves: ['image appearance'],
        loses: ['windowing options', 'metadata'],
      },
      {
        strategy: 'ai_analyze',
        outputFormat: 'text',
        preserves: ['clinical interpretation'],
        loses: ['raw data'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'pydicom',
        pythonPackage: 'pydicom',
        capabilities: ['parse', 'modify', 'convert'],
        outputFormats: ['json', 'png', 'nifti'],
        priority: 1,
      },
      {
        name: 'dcmtk',
        systemBinary: 'dcmtk',
        capabilities: ['convert', 'validate'],
        outputFormats: ['jpeg', 'png', 'json'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is a DICOM medical image. Describe the imaging modality, anatomical region, and any visible findings. Note: Do not provide medical diagnoses.',
    complexity: 'complex',
    binaryFormat: true,
  },

  // HL7 FHIR
  {
    format: 'fhir',
    extensions: ['.json', '.xml'],
    mimeTypes: ['application/fhir+json', 'application/fhir+xml'],
    domain: 'medical',
    subDomain: 'Health Records',
    description: 'HL7 FHIR - Healthcare interoperability standard',
    conversionStrategies: [
      {
        strategy: 'parse_resources',
        outputFormat: 'json',
        preserves: ['structured data', 'references'],
        loses: [],
      },
      {
        strategy: 'summarize',
        outputFormat: 'text',
        preserves: ['key clinical info'],
        loses: ['full detail'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'fhir.resources',
        pythonPackage: 'fhir.resources',
        capabilities: ['parse', 'validate'],
        outputFormats: ['json', 'xml'],
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is an HL7 FHIR resource. Summarize the clinical information while respecting patient privacy.',
    complexity: 'moderate',
    binaryFormat: false,
  },
];

// ============================================================================
// SCIENTIFIC/RESEARCH FORMATS
// ============================================================================

export const SCIENTIFIC_FORMATS: DomainFormat[] = [
  // NetCDF
  {
    format: 'netcdf',
    extensions: ['.nc', '.nc4', '.netcdf'],
    mimeTypes: ['application/x-netcdf'],
    domain: 'scientific',
    subDomain: 'Climate/Geoscience',
    description: 'Network Common Data Form - Scientific array data',
    conversionStrategies: [
      {
        strategy: 'extract_variables',
        outputFormat: 'json',
        preserves: ['variable names', 'dimensions', 'attributes'],
        loses: ['raw data'],
      },
      {
        strategy: 'export_csv',
        outputFormat: 'csv',
        preserves: ['data values'],
        loses: ['multidimensionality'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'netCDF4',
        pythonPackage: 'netCDF4',
        capabilities: ['parse', 'analyze'],
        outputFormats: ['json', 'csv'],
        priority: 1,
      },
      {
        name: 'xarray',
        pythonPackage: 'xarray',
        capabilities: ['parse', 'analyze', 'visualize'],
        outputFormats: ['csv', 'zarr'],
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is a NetCDF scientific data file. Describe the variables, dimensions, and what scientific domain this data represents.',
    complexity: 'complex',
    binaryFormat: true,
  },

  // HDF5
  {
    format: 'hdf5',
    extensions: ['.h5', '.hdf5', '.hdf'],
    mimeTypes: ['application/x-hdf5'],
    domain: 'scientific',
    subDomain: 'Data Storage',
    description: 'Hierarchical Data Format 5 - Scientific data container',
    conversionStrategies: [
      {
        strategy: 'extract_structure',
        outputFormat: 'json',
        preserves: ['groups', 'datasets', 'attributes'],
        loses: ['raw data'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'h5py',
        pythonPackage: 'h5py',
        capabilities: ['parse', 'analyze'],
        outputFormats: ['json'],
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is an HDF5 data file. Describe the hierarchical structure and what type of data it likely contains.',
    complexity: 'complex',
    binaryFormat: true,
  },

  // FITS - Astronomy
  {
    format: 'fits',
    extensions: ['.fits', '.fit', '.fts'],
    mimeTypes: ['application/fits', 'image/fits'],
    domain: 'scientific',
    subDomain: 'Astronomy',
    description: 'Flexible Image Transport System - Astronomical data',
    conversionStrategies: [
      {
        strategy: 'extract_header',
        outputFormat: 'json',
        preserves: ['metadata', 'WCS', 'observation info'],
        loses: ['image data'],
      },
      {
        strategy: 'render_image',
        outputFormat: 'png',
        preserves: ['visual representation'],
        loses: ['dynamic range'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'astropy',
        pythonPackage: 'astropy',
        capabilities: ['parse', 'analyze', 'convert'],
        outputFormats: ['json', 'png', 'csv'],
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is a FITS astronomical data file. Describe the observation, celestial coordinates, and visible features.',
    complexity: 'complex',
    binaryFormat: true,
  },
];

// ============================================================================
// GEOSPATIAL FORMATS
// ============================================================================

export const GEOSPATIAL_FORMATS: DomainFormat[] = [
  // Shapefile
  {
    format: 'shapefile',
    extensions: ['.shp', '.shx', '.dbf', '.prj'],
    mimeTypes: ['application/x-shapefile'],
    domain: 'geospatial',
    subDomain: 'GIS',
    description: 'ESRI Shapefile - Vector geospatial data',
    conversionStrategies: [
      {
        strategy: 'convert_to_geojson',
        outputFormat: 'geojson',
        preserves: ['geometry', 'attributes'],
        loses: ['some projections'],
      },
      {
        strategy: 'extract_features',
        outputFormat: 'json',
        preserves: ['feature count', 'bounds', 'fields'],
        loses: ['geometry'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'geopandas',
        pythonPackage: 'geopandas',
        capabilities: ['parse', 'analyze', 'convert'],
        outputFormats: ['geojson', 'csv'],
        priority: 1,
      },
      {
        name: 'shapefile',
        npmPackage: 'shapefile',
        capabilities: ['parse'],
        outputFormats: ['geojson'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is a Shapefile geospatial dataset. Describe the geographic features, coverage area, and attribute fields.',
    complexity: 'moderate',
    binaryFormat: true,
  },

  // GeoTIFF
  {
    format: 'geotiff',
    extensions: ['.tif', '.tiff', '.geotiff'],
    mimeTypes: ['image/tiff', 'image/geotiff'],
    domain: 'geospatial',
    subDomain: 'Raster GIS',
    description: 'GeoTIFF - Georeferenced raster image',
    conversionStrategies: [
      {
        strategy: 'extract_metadata',
        outputFormat: 'json',
        preserves: ['bounds', 'CRS', 'resolution'],
        loses: ['raster data'],
      },
      {
        strategy: 'render_preview',
        outputFormat: 'png',
        preserves: ['visual appearance'],
        loses: ['georeferencing'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'rasterio',
        pythonPackage: 'rasterio',
        capabilities: ['parse', 'analyze', 'convert'],
        outputFormats: ['png', 'json'],
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is a GeoTIFF raster image. Describe the geographic coverage, resolution, and what the imagery shows.',
    complexity: 'moderate',
    binaryFormat: true,
  },
];

// ============================================================================
// LEGAL/DOCUMENT FORMATS
// ============================================================================

export const LEGAL_FORMATS: DomainFormat[] = [
  // Legal XML (Court filings)
  {
    format: 'legal_xml',
    extensions: ['.xml'],
    mimeTypes: ['application/legal+xml'],
    domain: 'legal',
    subDomain: 'Court Documents',
    description: 'Legal XML - Court filing and case management',
    conversionStrategies: [
      {
        strategy: 'extract_structured',
        outputFormat: 'json',
        preserves: ['parties', 'dates', 'case info'],
        loses: [],
      },
      {
        strategy: 'convert_to_text',
        outputFormat: 'text',
        preserves: ['content'],
        loses: ['structure'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'lxml',
        pythonPackage: 'lxml',
        capabilities: ['parse'],
        outputFormats: ['json', 'text'],
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is a legal XML document. Summarize the case information, parties involved, and key dates.',
    complexity: 'moderate',
    binaryFormat: false,
  },
];

// ============================================================================
// BIOINFORMATICS FORMATS
// ============================================================================

export const BIOINFORMATICS_FORMATS: DomainFormat[] = [
  // FASTA - Sequence data
  {
    format: 'fasta',
    extensions: ['.fasta', '.fa', '.fna', '.faa'],
    mimeTypes: ['text/x-fasta'],
    domain: 'bioinformatics',
    subDomain: 'Sequence Analysis',
    description: 'FASTA format - DNA/RNA/Protein sequences',
    conversionStrategies: [
      {
        strategy: 'parse_sequences',
        outputFormat: 'json',
        preserves: ['sequences', 'headers', 'lengths'],
        loses: [],
      },
      {
        strategy: 'analyze_composition',
        outputFormat: 'json',
        preserves: ['GC content', 'length stats'],
        loses: ['raw sequence'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'Biopython',
        pythonPackage: 'biopython',
        capabilities: ['parse', 'analyze'],
        outputFormats: ['json', 'genbank'],
        priority: 1,
      },
    ],
    aiDescriptionPrompt: 'This is a FASTA sequence file. Describe the sequences, their likely source organism, and potential function.',
    complexity: 'simple',
    binaryFormat: false,
  },

  // PDB - Protein structure
  {
    format: 'pdb',
    extensions: ['.pdb', '.ent'],
    mimeTypes: ['chemical/x-pdb'],
    domain: 'bioinformatics',
    subDomain: 'Structural Biology',
    description: 'Protein Data Bank format - 3D molecular structure',
    conversionStrategies: [
      {
        strategy: 'extract_structure',
        outputFormat: 'json',
        preserves: ['atoms', 'residues', 'chains'],
        loses: [],
      },
      {
        strategy: 'render_3d',
        outputFormat: 'image',
        preserves: ['visual structure'],
        loses: ['interactivity'],
      },
    ],
    recommendedLibraries: [
      {
        name: 'Biopython',
        pythonPackage: 'biopython',
        capabilities: ['parse', 'analyze'],
        outputFormats: ['json', 'mmcif'],
        priority: 1,
      },
      {
        name: 'py3Dmol',
        pythonPackage: 'py3Dmol',
        capabilities: ['render'],
        outputFormats: ['image', 'html'],
        priority: 2,
      },
    ],
    aiDescriptionPrompt: 'This is a PDB protein structure file. Describe the protein, its chains, and notable structural features.',
    complexity: 'complex',
    binaryFormat: false,
  },
];

// ============================================================================
// COMBINED REGISTRY
// ============================================================================

export const ALL_DOMAIN_FORMATS: DomainFormat[] = [
  ...MECHANICAL_ENGINEERING_FORMATS,
  ...ELECTRICAL_ENGINEERING_FORMATS,
  ...MEDICAL_FORMATS,
  ...SCIENTIFIC_FORMATS,
  ...GEOSPATIAL_FORMATS,
  ...LEGAL_FORMATS,
  ...BIOINFORMATICS_FORMATS,
];

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Find domain format by extension
 */
export function findFormatByExtension(extension: string): DomainFormat | undefined {
  const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  return ALL_DOMAIN_FORMATS.find(f => f.extensions.includes(ext));
}

/**
 * Find domain format by MIME type
 */
export function findFormatByMimeType(mimeType: string): DomainFormat | undefined {
  return ALL_DOMAIN_FORMATS.find(f => f.mimeTypes.includes(mimeType.toLowerCase()));
}

/**
 * Get all formats for a domain
 */
export function getFormatsForDomain(domain: DomainCategory): DomainFormat[] {
  return ALL_DOMAIN_FORMATS.filter(f => f.domain === domain);
}

/**
 * Get recommended library for format conversion
 */
export function getRecommendedLibrary(format: DomainFormat): LibraryRecommendation | undefined {
  return format.recommendedLibraries.sort((a, b) => a.priority - b.priority)[0];
}

/**
 * Check if format is supported
 */
export function isDomainFormat(extension: string): boolean {
  return findFormatByExtension(extension) !== undefined;
}

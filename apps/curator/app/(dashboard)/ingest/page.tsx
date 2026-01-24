'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  FolderTree,
  Database,
  Link as LinkIcon,
  Cloud,
  Server,
  HardDrive,
  FileStack,
  ArrowRight,
  Settings,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';
import { toast } from 'sonner';

type ConnectorType = 's3' | 'azure_blob' | 'sharepoint' | 'google_drive' | 'snowflake' | 'confluence';

interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  status: 'connected' | 'syncing' | 'error' | 'pending';
  lastSync?: string;
  stubNodesCreated: number;
}

const connectorTypes: { type: ConnectorType; label: string; icon: any; description: string }[] = [
  { type: 's3', label: 'Amazon S3', icon: Cloud, description: 'Connect to S3 buckets' },
  { type: 'azure_blob', label: 'Azure Blob', icon: Cloud, description: 'Connect to Azure storage' },
  { type: 'sharepoint', label: 'SharePoint', icon: FileStack, description: 'Connect to SharePoint sites' },
  { type: 'google_drive', label: 'Google Drive', icon: HardDrive, description: 'Connect to Google Drive' },
  { type: 'snowflake', label: 'Snowflake', icon: Database, description: 'Connect to Snowflake DB' },
  { type: 'confluence', label: 'Confluence', icon: FileText, description: 'Connect to Confluence wiki' },
];

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  nodesCreated?: number;
}

const domains = [
  { id: 'engineering', name: 'Engineering', children: [
    { id: 'hydraulics', name: 'Hydraulics' },
    { id: 'electrical', name: 'Electrical' },
    { id: 'mechanical', name: 'Mechanical' },
  ]},
  { id: 'operations', name: 'Operations', children: [
    { id: 'maintenance', name: 'Maintenance' },
    { id: 'safety', name: 'Safety Procedures' },
  ]},
  { id: 'compliance', name: 'Compliance', children: [
    { id: 'osha', name: 'OSHA Regulations' },
    { id: 'internal', name: 'Internal Policies' },
  ]},
];

export default function IngestPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [expandedDomains, setExpandedDomains] = useState<string[]>(['engineering']);
  
  // Connector state
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [showConnectorWizard, setShowConnectorWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedConnectorType, setSelectedConnectorType] = useState<ConnectorType | null>(null);
  const [connectorName, setConnectorName] = useState('');
  const [connectorConfig, setConnectorConfig] = useState<Record<string, string>>({});
  const [connectingLoader, setConnectingLoader] = useState(false);

  useEffect(() => {
    async function fetchConnectors() {
      try {
        const res = await fetch('/api/curator/connectors');
        if (res.ok) {
          const data = await res.json();
          setConnectors(data.connectors || []);
        }
      } catch (error) {
        console.error('Failed to fetch connectors:', error);
      }
    }
    fetchConnectors();
  }, []);

  const handleCreateConnector = async () => {
    if (!selectedConnectorType || !connectorName) {
      toast.error('Error', { description: 'Please fill in all required fields.' });
      return;
    }
    setConnectingLoader(true);
    try {
      const res = await fetch('/api/curator/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: connectorName,
          type: selectedConnectorType,
          config: connectorConfig,
          domainId: selectedDomain || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConnectors((prev) => [...prev, data]);
        toast.success('Connector Created', {
          description: 'Zero-copy connector is now indexing metadata.',
        });
        resetWizard();
      } else {
        throw new Error('Failed to create');
      }
    } catch (error) {
      toast.error('Error', { description: 'Failed to create connector. Please try again.' });
    } finally {
      setConnectingLoader(false);
    }
  };

  const handleSyncConnector = async (connectorId: string) => {
    try {
      const res = await fetch(`/api/curator/connectors/${connectorId}/sync`, { method: 'POST' });
      if (res.ok) {
        setConnectors((prev) =>
          prev.map((c) => (c.id === connectorId ? { ...c, status: 'syncing' } : c))
        );
        toast.success('Sync Started', { description: 'Connector is now syncing metadata.' });
      }
    } catch (error) {
      toast.error('Error', { description: 'Failed to start sync.' });
    }
  };

  const resetWizard = () => {
    setShowConnectorWizard(false);
    setWizardStep(1);
    setSelectedConnectorType(null);
    setConnectorName('');
    setConnectorConfig({});
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    // Simulate processing
    newFiles.forEach((file) => {
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: 'processing', progress: 30 } : f
          )
        );
      }, 500);

      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, progress: 70 } : f
          )
        );
      }, 1500);

      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: 'complete', progress: 100, nodesCreated: Math.floor(Math.random() * 50) + 10 }
              : f
          )
        );
      }, 2500);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
    },
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleDomain = (id: string) => {
    setExpandedDomains((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ingest Documents</h1>
        <p className="text-muted-foreground mt-1">
          Upload documents to teach the AI. Select a domain to categorize the knowledge.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Domain Selection */}
        <div className="lg:col-span-1">
          <GlassCard variant="default" padding="md">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <FolderTree className="h-4 w-4" />
              Select Domain
            </h3>
            <div className="space-y-1">
              {domains.map((domain) => (
                <div key={domain.id}>
                  <button
                    onClick={() => toggleDomain(domain.id)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm font-medium"
                  >
                    {expandedDomains.includes(domain.id) ? '▼' : '▶'} {domain.name}
                  </button>
                  {expandedDomains.includes(domain.id) && domain.children && (
                    <div className="ml-4 space-y-1">
                      {domain.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setSelectedDomain(child.id)}
                          className={cn(
                            'w-full text-left px-3 py-1.5 rounded-md text-sm',
                            selectedDomain === child.id
                              ? 'bg-curator-gold/10 text-curator-gold font-medium'
                              : 'hover:bg-accent text-muted-foreground'
                          )}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Zero-Copy Connectors */}
          <GlassCard variant="default" padding="md" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Zero-Copy Sources
              </h3>
              <button
                onClick={() => setShowConnectorWizard(true)}
                className="text-xs text-curator-gold hover:underline"
              >
                + Add
              </button>
            </div>
            
            {/* Connected Sources */}
            {connectors.length > 0 ? (
              <div className="space-y-2">
                {connectors.map((connector) => {
                  const typeInfo = connectorTypes.find((t) => t.type === connector.type);
                  const Icon = typeInfo?.icon || Cloud;
                  return (
                    <div
                      key={connector.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{connector.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {connector.stubNodesCreated} stubs indexed
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {connector.status === 'syncing' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-curator-gold" />
                        ) : connector.status === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <button
                            onClick={() => handleSyncConnector(connector.id)}
                            className="p-1 hover:bg-accent rounded"
                            title="Sync"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <Cloud className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No connectors yet</p>
                <button
                  onClick={() => setShowConnectorWizard(true)}
                  className="text-xs text-curator-gold hover:underline mt-1"
                >
                  Connect a data source
                </button>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              'upload-zone cursor-pointer',
              isDragActive && 'active'
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center text-center">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="font-medium">
                {isDragActive
                  ? 'Drop files here...'
                  : 'Drag & drop documents here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse (PDF, DOC, DOCX, TXT, CSV)
              </p>
              {selectedDomain && (
                <p className="text-sm text-curator-gold mt-3">
                  ✓ Will be categorized under: <strong>{selectedDomain}</strong>
                </p>
              )}
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <GlassCard variant="default" padding="none">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Uploaded Files ({files.length})</h3>
              </div>
              <div className="divide-y">
                {files.map((file) => (
                  <div key={file.id} className="p-4 flex items-center gap-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                        {file.nodesCreated && ` • ${file.nodesCreated} nodes created`}
                      </p>
                      {file.status === 'processing' && (
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-curator-gold transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'pending' && (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      )}
                      {file.status === 'processing' && (
                        <Loader2 className="h-5 w-5 animate-spin text-curator-gold" />
                      )}
                      {file.status === 'complete' && (
                        <CheckCircle2 className="h-5 w-5 text-curator-emerald" />
                      )}
                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-1 hover:bg-accent rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Zero-Copy Connector Wizard Modal */}
      {showConnectorWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Connect Data Source</h2>
                <p className="text-sm text-muted-foreground">
                  Zero-copy indexing - metadata only, files stay in place
                </p>
              </div>
              <button onClick={resetWizard} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                      wizardStep >= step
                        ? 'bg-curator-gold text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={cn('w-12 h-1 rounded', wizardStep > step ? 'bg-curator-gold' : 'bg-muted')} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Select Connector Type */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Select source type:</p>
                <div className="grid grid-cols-2 gap-3">
                  {connectorTypes.map((ct) => (
                    <button
                      key={ct.type}
                      onClick={() => {
                        setSelectedConnectorType(ct.type);
                        setWizardStep(2);
                      }}
                      className="p-4 border rounded-lg hover:border-curator-gold hover:bg-curator-gold/5 transition-all text-left"
                    >
                      <ct.icon className="h-8 w-8 text-curator-gold mb-2" />
                      <p className="font-medium">{ct.label}</p>
                      <p className="text-xs text-muted-foreground">{ct.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Configure Connection */}
            {wizardStep === 2 && selectedConnectorType && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  {(() => {
                    const ct = connectorTypes.find((t) => t.type === selectedConnectorType);
                    const Icon = ct?.icon || Cloud;
                    return (
                      <>
                        <Icon className="h-6 w-6 text-curator-gold" />
                        <span className="font-medium">{ct?.label}</span>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="text-sm font-medium">Connection Name</label>
                  <input
                    type="text"
                    value={connectorName}
                    onChange={(e) => setConnectorName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                    placeholder="e.g., Production S3 Bucket"
                  />
                </div>

                {selectedConnectorType === 's3' && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Bucket Name</label>
                      <input
                        type="text"
                        value={connectorConfig.bucket || ''}
                        onChange={(e) => setConnectorConfig({ ...connectorConfig, bucket: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                        placeholder="my-bucket"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Region</label>
                      <input
                        type="text"
                        value={connectorConfig.region || ''}
                        onChange={(e) => setConnectorConfig({ ...connectorConfig, region: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                        placeholder="us-east-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Prefix (optional)</label>
                      <input
                        type="text"
                        value={connectorConfig.prefix || ''}
                        onChange={(e) => setConnectorConfig({ ...connectorConfig, prefix: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                        placeholder="documents/"
                      />
                    </div>
                  </>
                )}

                {selectedConnectorType === 'sharepoint' && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Site URL</label>
                      <input
                        type="text"
                        value={connectorConfig.siteUrl || ''}
                        onChange={(e) => setConnectorConfig({ ...connectorConfig, siteUrl: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                        placeholder="https://company.sharepoint.com/sites/docs"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Document Library</label>
                      <input
                        type="text"
                        value={connectorConfig.library || ''}
                        onChange={(e) => setConnectorConfig({ ...connectorConfig, library: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                        placeholder="Shared Documents"
                      />
                    </div>
                  </>
                )}

                {(selectedConnectorType === 'google_drive' || selectedConnectorType === 'confluence' || selectedConnectorType === 'azure_blob' || selectedConnectorType === 'snowflake') && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      OAuth authentication will be configured after creating the connector.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="flex-1 py-2 border rounded-lg hover:bg-accent"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setWizardStep(3)}
                    disabled={!connectorName}
                    className="flex-1 py-2 bg-curator-gold text-white rounded-lg hover:bg-curator-gold/90 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm & Connect */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Source Type</span>
                    <span className="font-medium">
                      {connectorTypes.find((t) => t.type === selectedConnectorType)?.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Connection Name</span>
                    <span className="font-medium">{connectorName}</span>
                  </div>
                  {selectedDomain && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Target Domain</span>
                      <span className="font-medium">{selectedDomain}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 border border-curator-gold/30 bg-curator-gold/5 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Server className="h-5 w-5 text-curator-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-curator-gold">Zero-Copy Indexing</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Only metadata will be indexed. Files remain in their original location.
                        Stub nodes will be created that can be expanded on-demand.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="flex-1 py-2 border rounded-lg hover:bg-accent"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreateConnector}
                    disabled={connectingLoader}
                    className="flex-1 py-2 bg-curator-gold text-white rounded-lg hover:bg-curator-gold/90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {connectingLoader ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )}
                    Connect Source
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

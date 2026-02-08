'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface FirmwareStatus {
  brain_id: string;
  firmware_hash: string;
  active_firmware_id: string;
  hilbert_dimension: number;
  last_norm_value: number;
  unitarity_corrections_count: number;
  fw_status: string;
  content_hash: string;
  is_verified: boolean;
  signed_by: string;
  fw_created_at: string;
  quantum: any;
  fw_hilbert_dim: number;
  unitarity_mode: string;
}

const fetchStatus = async (brainId: string): Promise<FirmwareStatus> => {
  const response = await fetch(`/api/admin/omega/firmware/status?brain_id=${brainId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to load' }));
    throw new Error(err.error || 'Failed to load');
  }
  return response.json();
};

export default function OmegaFirmwarePage() {
  const queryClient = useQueryClient();
  const [brainId, setBrainId] = useState('');
  const [firmwareId, setFirmwareId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['omega-firmware-status', brainId],
    queryFn: () => fetchStatus(brainId),
    enabled: brainId.length > 0,
    refetchInterval: 10_000
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/omega/firmware/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmware_id: firmwareId, brain_id: brainId })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: (data) => {
      setMessage({ type: 'success', text: data.message });
      queryClient.invalidateQueries({ queryKey: ['omega-firmware-status'] });
    },
    onError: (error: Error) => {
      setMessage({ type: 'error', text: error.message });
    }
  });

  const revertMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/omega/firmware/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brain_id: brainId })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: (data) => {
      setMessage({ type: 'success', text: `Reverted to firmware ${data.reverted_to}` });
      queryClient.invalidateQueries({ queryKey: ['omega-firmware-status'] });
    },
    onError: (error: Error) => {
      setMessage({ type: 'error', text: error.message });
    }
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">OMEGA Firmware Management</h1>
      <p className="text-sm text-gray-500">
        Manage quantum firmware for OMEGA brains. Firmware activation triggers a hot-swap on the next inference cycle.
      </p>

      {/* Brain Selector */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Brain ID (UUID)"
          value={brainId}
          onChange={(e) => setBrainId(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={() => refetch()}
          disabled={!brainId}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Load
        </button>
      </div>

      {/* Status Display */}
      {isLoading && <p className="text-gray-500 text-sm">Loading firmware status...</p>}

      {data && (
        <div className="border border-gray-200 rounded-lg p-5 space-y-4 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Active Firmware</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              data.fw_status === 'active' ? 'bg-green-100 text-green-800' :
              data.fw_status === 'superseded' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {data.fw_status || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium text-gray-500">Firmware ID:</span>
              <p className="font-mono text-gray-900">{data.active_firmware_id || 'None'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Hilbert Dimension:</span>
              <p className="text-gray-900">{data.fw_hilbert_dim || data.hilbert_dimension}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Unitarity Mode:</span>
              <p className="text-gray-900">{data.unitarity_mode || 'renormalize'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Last Norm:</span>
              <p className="font-mono text-gray-900">
                {data.last_norm_value != null ? Number(data.last_norm_value).toFixed(8) : 'N/A'}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Corrections:</span>
              <p className="text-gray-900">{data.unitarity_corrections_count ?? 0}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Verified:</span>
              <p className="text-gray-900">{data.is_verified ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Signer:</span>
              <p className="font-mono text-gray-900 truncate">{data.signed_by || 'N/A'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Created:</span>
              <p className="text-gray-900">
                {data.fw_created_at ? new Date(data.fw_created_at).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-500">Content Hash:</span>
            <p className="text-xs font-mono text-gray-400 break-all">{data.firmware_hash || 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Activate Firmware */}
      <div className="border border-gray-200 rounded-lg p-5 space-y-3 bg-white shadow-sm">
        <h2 className="font-semibold text-gray-900">Activate New Firmware</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Firmware ID (UUID)"
            value={firmwareId}
            onChange={(e) => setFirmwareId(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <button
            onClick={() => activateMutation.mutate()}
            disabled={!firmwareId || !brainId || activateMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {activateMutation.isPending ? 'Activating...' : 'Activate'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          2-person rule: You cannot activate firmware that you signed. A different admin must activate.
        </p>
      </div>

      {/* Emergency Revert */}
      <div className="border border-red-200 rounded-lg p-5 space-y-3 bg-red-50">
        <h2 className="font-semibold text-red-900">Emergency Revert</h2>
        <p className="text-sm text-red-700">
          Revert to the previously superseded firmware. This triggers an immediate hot-swap on next inference.
        </p>
        <button
          onClick={() => revertMutation.mutate()}
          disabled={!brainId || revertMutation.isPending}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {revertMutation.isPending ? 'Reverting...' : 'Revert to Previous Firmware'}
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 border rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 text-xs underline opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}

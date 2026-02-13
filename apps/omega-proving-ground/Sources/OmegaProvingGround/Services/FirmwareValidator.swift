import Foundation

final class FirmwareValidator: Sendable {

    func validate(data: Data) -> FirmwareValidationResult {
        var checks: [ValidationCheck] = []
        var firmware: BioFirmware?

        // 1. Schema validation
        do {
            firmware = try JSONDecoder().decode(BioFirmware.self, from: data)
            checks.append(ValidationCheck(
                category: .schema, name: "JSON Parse", description: "Firmware file is valid JSON",
                passed: true, severity: .critical, details: "Successfully parsed as BioFirmware"
            ))
        } catch {
            checks.append(ValidationCheck(
                category: .schema, name: "JSON Parse", description: "Firmware file is valid JSON",
                passed: false, severity: .critical, details: "Parse error: \(error.localizedDescription)"
            ))
            return FirmwareValidationResult(firmwareName: "Unknown", timestamp: Date(), checks: checks)
        }

        guard let fw = firmware else { return FirmwareValidationResult(firmwareName: "Unknown", timestamp: Date(), checks: checks) }

        checks.append(ValidationCheck(
            category: .schema, name: "Schema Version", description: "Schema version is bio-v2",
            passed: fw.schema_version == "bio-v2", severity: .critical,
            details: "Found: \(fw.schema_version)"
        ))

        checks.append(ValidationCheck(
            category: .schema, name: "Firmware Version", description: "Firmware version is valid semver",
            passed: fw.firmware_version.split(separator: ".").count == 3, severity: .error,
            details: "Found: \(fw.firmware_version)"
        ))

        checks.append(ValidationCheck(
            category: .schema, name: "Metadata Complete", description: "All metadata fields present",
            passed: !fw.metadata.name.isEmpty && !fw.metadata.author.isEmpty && !fw.metadata.description.isEmpty,
            severity: .error, details: "Name: \(fw.metadata.name), Author: \(fw.metadata.author)"
        ))

        // 2. Safety invariants
        checks.append(ValidationCheck(
            category: .safety, name: "Invariant Count", description: "Exactly 9 safety invariants defined",
            passed: fw.safety_invariants.rules.count == 9, severity: .critical,
            details: "Found \(fw.safety_invariants.rules.count) invariants (expected 9)"
        ))

        let requiredIds = Set(["SI-01", "SI-02", "SI-03", "SI-04", "SI-05", "SI-06", "SI-07", "SI-08", "SI-09"])
        let foundIds = Set(fw.safety_invariants.rules.map(\.id))
        let missingIds = requiredIds.subtracting(foundIds)
        checks.append(ValidationCheck(
            category: .safety, name: "All Invariant IDs Present", description: "SI-01 through SI-09 all defined",
            passed: missingIds.isEmpty, severity: .critical,
            details: missingIds.isEmpty ? "All 9 invariant IDs present" : "Missing: \(missingIds.sorted().joined(separator: ", "))"
        ))

        let hardBlocks = fw.safety_invariants.rules.filter { $0.enforcement == "hard_block" }
        checks.append(ValidationCheck(
            category: .safety, name: "Hard Block Enforcement", description: "Critical invariants use hard_block",
            passed: hardBlocks.count >= 6, severity: .critical,
            details: "\(hardBlocks.count) rules use hard_block enforcement"
        ))

        let validCheckpoints = Set(["CP1", "CP2", "CP3", "CP4", "CP5"])
        let allCheckpointsValid = fw.safety_invariants.rules.allSatisfy { validCheckpoints.contains($0.cato_checkpoint) }
        checks.append(ValidationCheck(
            category: .safety, name: "CATO Checkpoint Mapping", description: "All invariants map to valid CATO checkpoints (CP1-CP5)",
            passed: allCheckpointsValid, severity: .error,
            details: allCheckpointsValid ? "All mappings valid" : "Invalid checkpoint references found"
        ))

        // 3. Behavioral parameters
        checks.append(ValidationCheck(
            category: .behavioral, name: "Temperature Range", description: "Temperature within safe bounds (0.0-2.0)",
            passed: fw.behavioral_parameters.min_temperature >= 0.0 && fw.behavioral_parameters.max_temperature <= 2.0,
            severity: .warning,
            details: "Range: \(fw.behavioral_parameters.min_temperature)-\(fw.behavioral_parameters.max_temperature)"
        ))

        checks.append(ValidationCheck(
            category: .behavioral, name: "Default Temperature", description: "Default temperature within configured range",
            passed: fw.behavioral_parameters.default_temperature >= fw.behavioral_parameters.min_temperature
                && fw.behavioral_parameters.default_temperature <= fw.behavioral_parameters.max_temperature,
            severity: .error,
            details: "Default: \(fw.behavioral_parameters.default_temperature)"
        ))

        checks.append(ValidationCheck(
            category: .behavioral, name: "Token Limits", description: "Default tokens <= absolute max",
            passed: fw.behavioral_parameters.default_max_tokens <= fw.behavioral_parameters.absolute_max_tokens,
            severity: .error,
            details: "Default: \(fw.behavioral_parameters.default_max_tokens), Max: \(fw.behavioral_parameters.absolute_max_tokens)"
        ))

        checks.append(ValidationCheck(
            category: .behavioral, name: "Persona Configured", description: "Persona has name and style",
            passed: !fw.behavioral_parameters.persona.name.isEmpty && !fw.behavioral_parameters.persona.style.isEmpty,
            severity: .warning,
            details: "Persona: \(fw.behavioral_parameters.persona.name) (\(fw.behavioral_parameters.persona.style))"
        ))

        let validDelightModes = Set(["auto", "professional", "subtle", "expressive", "playful"])
        checks.append(ValidationCheck(
            category: .behavioral, name: "Delight Mode Valid", description: "Delight mode is one of: auto, professional, subtle, expressive, playful",
            passed: validDelightModes.contains(fw.behavioral_parameters.persona.delight_mode),
            severity: .warning,
            details: "Mode: \(fw.behavioral_parameters.persona.delight_mode)"
        ))

        // 4. Routing rules
        checks.append(ValidationCheck(
            category: .routing, name: "Task Routes Defined", description: "At least one task routing rule exists",
            passed: !fw.routing_rules.task_routing.isEmpty, severity: .error,
            details: "\(fw.routing_rules.task_routing.count) task routes defined"
        ))

        checks.append(ValidationCheck(
            category: .routing, name: "Fallback Chain", description: "Fallback chain has at least 2 models",
            passed: fw.routing_rules.fallback_chain.count >= 2, severity: .error,
            details: "Chain: \(fw.routing_rules.fallback_chain.joined(separator: " → "))"
        ))

        checks.append(ValidationCheck(
            category: .routing, name: "Circuit Breaker Threshold", description: "Circuit breaker threshold is reasonable (1-20)",
            passed: fw.routing_rules.circuit_breaker_threshold >= 1 && fw.routing_rules.circuit_breaker_threshold <= 20,
            severity: .warning,
            details: "Threshold: \(fw.routing_rules.circuit_breaker_threshold)"
        ))

        let consensusRoutes = fw.routing_rules.task_routing.filter { $0.require_consensus == true }
        for route in consensusRoutes {
            let confidence = route.min_consensus_confidence ?? 0
            checks.append(ValidationCheck(
                category: .routing, name: "Consensus Confidence (\(route.task_type))", description: "Consensus confidence threshold >= 0.7",
                passed: confidence >= 0.7, severity: .error,
                details: "\(route.task_type): min confidence = \(confidence)"
            ))
        }

        // 5. Compliance
        checks.append(ValidationCheck(
            category: .compliance, name: "Audit Level", description: "Audit level is 'standard' or 'enhanced'",
            passed: ["standard", "enhanced"].contains(fw.compliance_flags.audit_level),
            severity: .error,
            details: "Level: \(fw.compliance_flags.audit_level)"
        ))

        checks.append(ValidationCheck(
            category: .compliance, name: "Data Residency", description: "Data residency region specified",
            passed: !fw.compliance_flags.data_residency_region.isEmpty, severity: .error,
            details: "Region: \(fw.compliance_flags.data_residency_region)"
        ))

        if fw.compliance_flags.hipaa_enabled {
            checks.append(ValidationCheck(
                category: .compliance, name: "HIPAA + ZDR", description: "HIPAA requires zero data retention",
                passed: fw.compliance_flags.zero_data_retention, severity: .critical,
                details: "Zero data retention: \(fw.compliance_flags.zero_data_retention)"
            ))
        }

        // 6. Resource limits
        checks.append(ValidationCheck(
            category: .resources, name: "Rate Limit", description: "Rate limit > 0 and <= 10000 RPM",
            passed: fw.resource_limits.rate_limit_rpm > 0 && fw.resource_limits.rate_limit_rpm <= 10000,
            severity: .error,
            details: "\(fw.resource_limits.rate_limit_rpm) RPM"
        ))

        checks.append(ValidationCheck(
            category: .resources, name: "Cost Ceiling", description: "Daily cost ceiling configured",
            passed: fw.resource_limits.cost_ceiling_daily_usd > 0, severity: .warning,
            details: "$\(String(format: "%.2f", fw.resource_limits.cost_ceiling_daily_usd))/day"
        ))

        checks.append(ValidationCheck(
            category: .resources, name: "Context Window", description: "Context window <= 200K tokens",
            passed: fw.resource_limits.max_context_window <= 200000, severity: .warning,
            details: "\(fw.resource_limits.max_context_window) tokens"
        ))

        // 7. Integrations
        if let integrations = fw.integrations {
            if let mcpServers = integrations.mcp_servers {
                let allSandboxed = mcpServers.allSatisfy { $0.sandboxed }
                checks.append(ValidationCheck(
                    category: .integrations, name: "MCP Sandboxing", description: "All MCP servers should be sandboxed",
                    passed: allSandboxed, severity: .warning,
                    details: "\(mcpServers.count) servers, \(mcpServers.filter(\.sandboxed).count) sandboxed"
                ))
            }

            if let agents = integrations.a2a_agents {
                let allRequireJWS = agents.allSatisfy { $0.require_jws }
                checks.append(ValidationCheck(
                    category: .integrations, name: "A2A JWS Enforcement", description: "All A2A agents should require JWS signing",
                    passed: allRequireJWS, severity: .error,
                    details: "\(agents.count) agents, \(agents.filter(\.require_jws).count) require JWS"
                ))
            }
        }

        // 8. Security
        checks.append(ValidationCheck(
            category: .security, name: "Firmware Signature", description: "Firmware should be cryptographically signed",
            passed: fw.metadata.signature != "unsigned-local-testing", severity: .warning,
            details: "Signature: \(fw.metadata.signature.prefix(40))..."
        ))

        checks.append(ValidationCheck(
            category: .security, name: "Classification Banner", description: "Classification is set",
            passed: !fw.metadata.classification.isEmpty, severity: .info,
            details: fw.metadata.classification
        ))

        return FirmwareValidationResult(firmwareName: fw.metadata.name, timestamp: Date(), checks: checks)
    }

    func loadAndValidate(url: URL) -> FirmwareValidationResult {
        do {
            let data = try Data(contentsOf: url)
            return validate(data: data)
        } catch {
            return FirmwareValidationResult(
                firmwareName: url.lastPathComponent,
                timestamp: Date(),
                checks: [ValidationCheck(
                    category: .schema, name: "File Read", description: "Can read firmware file",
                    passed: false, severity: .critical, details: "Error: \(error.localizedDescription)"
                )]
            )
        }
    }
}

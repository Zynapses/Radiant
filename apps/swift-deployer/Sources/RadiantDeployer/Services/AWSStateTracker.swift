// RADIANT - AWS State Tracker
// Persistent tracking of ALL AWS resources for bi-directional sync
// Uses delta compression to minimize storage

import Foundation

actor AWSStateTracker {
    
    // MARK: - Types
    
    /// Complete tracked state of an AWS environment
    struct TrackedEnvironmentState: Codable, Sendable {
        let appId: String
        let environment: String
        let region: String
        var lastFullSync: Date
        var lastDeltaSync: Date?
        
        // All tracked resources
        var iamRoles: [TrackedIAMRole]
        var iamPolicies: [TrackedIAMPolicy]
        var securityGroups: [TrackedSecurityGroup]
        var secrets: [TrackedSecret]
        var parameters: [TrackedParameter]
        var eventBridgeRules: [TrackedEventBridgeRule]
        var sqsQueues: [TrackedSQSQueue]
        var snsTopics: [TrackedSNSTopic]
        var cloudWatchAlarms: [TrackedCloudWatchAlarm]
        var cloudWatchDashboards: [TrackedCloudWatchDashboard]
        var apiGatewayApis: [TrackedAPIGateway]
        var cognitoPools: [TrackedCognitoPool]
        var stepFunctions: [TrackedStepFunction]
        var kinesisStreams: [TrackedKinesisStream]
        
        // Metadata
        var resourceCounts: [String: Int] {
            [
                "IAM Roles": iamRoles.count,
                "IAM Policies": iamPolicies.count,
                "Security Groups": securityGroups.count,
                "Secrets": secrets.count,
                "Parameters": parameters.count,
                "EventBridge Rules": eventBridgeRules.count,
                "SQS Queues": sqsQueues.count,
                "SNS Topics": snsTopics.count,
                "CloudWatch Alarms": cloudWatchAlarms.count,
                "CloudWatch Dashboards": cloudWatchDashboards.count,
                "API Gateways": apiGatewayApis.count,
                "Cognito Pools": cognitoPools.count,
                "Step Functions": stepFunctions.count,
                "Kinesis Streams": kinesisStreams.count
            ]
        }
        
        var totalResources: Int {
            resourceCounts.values.reduce(0, +)
        }
    }
    
    // MARK: - IAM Resources
    
    struct TrackedIAMRole: Codable, Sendable, Identifiable {
        let id: String // ARN
        let roleName: String
        let path: String
        let assumeRolePolicyDocument: String
        var attachedPolicies: [String] // Policy ARNs
        var inlinePolicies: [String: String] // Name -> Policy JSON
        let createDate: Date
        var isRadiantManaged: Bool // Created by CDK or manual
        var tags: [String: String]
    }
    
    struct TrackedIAMPolicy: Codable, Sendable, Identifiable {
        let id: String // ARN
        let policyName: String
        let path: String
        let policyDocument: String
        let createDate: Date
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    // MARK: - Security Groups
    
    struct TrackedSecurityGroup: Codable, Sendable, Identifiable {
        let id: String // Group ID
        let groupName: String
        let description: String
        let vpcId: String
        var ingressRules: [SecurityGroupRule]
        var egressRules: [SecurityGroupRule]
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    struct SecurityGroupRule: Codable, Sendable {
        let ipProtocol: String
        let fromPort: Int?
        let toPort: Int?
        let cidrBlocks: [String]
        let securityGroupIds: [String]
        let description: String?
    }
    
    // MARK: - Secrets & Parameters
    
    struct TrackedSecret: Codable, Sendable, Identifiable {
        let id: String // ARN
        let name: String
        let description: String?
        let kmsKeyId: String?
        var rotationEnabled: Bool
        var rotationLambdaArn: String?
        var rotationRules: String?
        var tags: [String: String]
        // NOTE: We do NOT store secret values - only metadata
        var isRadiantManaged: Bool
    }
    
    struct TrackedParameter: Codable, Sendable, Identifiable {
        let id: String // Name (used as ID)
        let name: String
        let type: String // String, StringList, SecureString
        let value: String? // Only stored for non-SecureString
        let description: String?
        let tier: String
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    // MARK: - EventBridge
    
    struct TrackedEventBridgeRule: Codable, Sendable, Identifiable {
        let id: String // ARN
        let name: String
        let eventBusName: String
        let eventPattern: String?
        let scheduleExpression: String?
        let state: String
        var targets: [EventBridgeTarget]
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    struct EventBridgeTarget: Codable, Sendable {
        let id: String
        let arn: String
        let roleArn: String?
        let input: String?
        let inputPath: String?
    }
    
    // MARK: - SQS
    
    struct TrackedSQSQueue: Codable, Sendable, Identifiable {
        let id: String // URL
        let queueName: String
        let queueArn: String
        var visibilityTimeout: Int
        var messageRetentionPeriod: Int
        var delaySeconds: Int
        var receiveMessageWaitTimeSeconds: Int
        var deadLetterTargetArn: String?
        var maxReceiveCount: Int?
        var policy: String?
        var redrivePolicy: String?
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    // MARK: - SNS
    
    struct TrackedSNSTopic: Codable, Sendable, Identifiable {
        let id: String // ARN
        let topicName: String
        var displayName: String?
        var policy: String?
        var deliveryPolicy: String?
        var subscriptions: [SNSSubscription]
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    struct SNSSubscription: Codable, Sendable {
        let subscriptionArn: String
        let protocol_: String
        let endpoint: String
        let filterPolicy: String?
    }
    
    // MARK: - CloudWatch
    
    struct TrackedCloudWatchAlarm: Codable, Sendable, Identifiable {
        let id: String // ARN
        let alarmName: String
        let alarmDescription: String?
        let metricName: String
        let namespace: String
        let statistic: String
        let period: Int
        let evaluationPeriods: Int
        let threshold: Double
        let comparisonOperator: String
        var alarmActions: [String]
        var okActions: [String]
        var insufficientDataActions: [String]
        var dimensions: [String: String]
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    struct TrackedCloudWatchDashboard: Codable, Sendable, Identifiable {
        let id: String // Name
        let dashboardName: String
        let dashboardBody: String // JSON
        var isRadiantManaged: Bool
    }
    
    // MARK: - API Gateway
    
    struct TrackedAPIGateway: Codable, Sendable, Identifiable {
        let id: String // API ID
        let name: String
        let apiType: String // REST, HTTP, WebSocket
        let description: String?
        let endpointConfiguration: String?
        var stages: [String]
        var routes: [APIGatewayRoute]
        var authorizers: [APIGatewayAuthorizer]
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    struct APIGatewayRoute: Codable, Sendable {
        let routeKey: String
        let target: String?
        let authorizationType: String?
        let authorizerId: String?
        
        /// Extract Lambda function name from integration target for dynamic ARN resolution
        /// Target format: integrations/abc123 (integration ID) - we need to look up the actual Lambda
        /// Or direct ARN: arn:aws:lambda:us-east-1:123456789:function:my-function
        var lambdaFunctionName: String? {
            guard let target = target else { return nil }
            
            // Check if target contains a Lambda ARN directly
            if let range = target.range(of: "function:") {
                let afterFunction = target[range.upperBound...]
                // Remove any version/alias suffix (after the colon)
                let functionName = afterFunction.components(separatedBy: ":").first 
                    ?? String(afterFunction)
                // Remove /invocations suffix if present
                return functionName.replacingOccurrences(of: "/invocations", with: "")
            }
            
            return nil
        }
        
        /// Parse route key to extract HTTP method and path
        var httpMethod: String {
            routeKey.components(separatedBy: " ").first ?? "ANY"
        }
        
        var path: String {
            routeKey.components(separatedBy: " ").last ?? "/"
        }
    }
    
    struct APIGatewayAuthorizer: Codable, Sendable {
        let id: String
        let name: String
        let type: String
        let identitySource: [String]
        let authorizerUri: String?
        
        // Extracted Lambda function name for dynamic ARN resolution
        var lambdaFunctionName: String? {
            // Extract function name from URI like:
            // arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123456789:function:my-function/invocations
            guard let uri = authorizerUri,
                  let range = uri.range(of: "function:"),
                  let endRange = uri.range(of: "/invocations") else {
                return nil
            }
            let start = uri.index(range.upperBound, offsetBy: 0)
            let end = endRange.lowerBound
            return String(uri[start..<end])
        }
    }
    
    // MARK: - Cognito
    
    struct TrackedCognitoPool: Codable, Sendable, Identifiable {
        let id: String // Pool ID
        let poolName: String
        let poolArn: String
        var autoVerifiedAttributes: [String]
        var usernameAttributes: [String]
        var mfaConfiguration: String
        var passwordPolicy: PasswordPolicy?
        var lambdaTriggers: [String: String] // TriggerType -> Lambda ARN
        var appClients: [CognitoAppClient]
        var isRadiantManaged: Bool
        var tags: [String: String]
        
        /// Extract Lambda function names from trigger ARNs for dynamic resolution
        var lambdaTriggerFunctionNames: [String: String] {
            var names: [String: String] = [:]
            for (triggerType, arn) in lambdaTriggers {
                // ARN format: arn:aws:lambda:us-east-1:123456789:function:my-function-name
                if let range = arn.range(of: "function:") {
                    let functionName = String(arn[range.upperBound...])
                    // Remove any version/alias suffix
                    let cleanName = functionName.components(separatedBy: ":").first ?? functionName
                    names[triggerType] = cleanName
                }
            }
            return names
        }
    }
    
    struct PasswordPolicy: Codable, Sendable {
        let minimumLength: Int
        let requireUppercase: Bool
        let requireLowercase: Bool
        let requireNumbers: Bool
        let requireSymbols: Bool
    }
    
    struct CognitoAppClient: Codable, Sendable {
        let clientId: String
        let clientName: String
        var allowedOAuthFlows: [String]
        var allowedOAuthScopes: [String]
        var callbackUrls: [String]
        var logoutUrls: [String]
    }
    
    // MARK: - Step Functions
    
    struct TrackedStepFunction: Codable, Sendable, Identifiable {
        let id: String // ARN
        let name: String
        let stateMachineType: String
        let definition: String // JSON ASL
        let roleArn: String
        var loggingConfiguration: String?
        var tracingConfiguration: String?
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    // MARK: - Kinesis
    
    struct TrackedKinesisStream: Codable, Sendable, Identifiable {
        let id: String // ARN
        let streamName: String
        var shardCount: Int
        var retentionPeriodHours: Int
        var encryptionType: String?
        var kmsKeyId: String?
        var isRadiantManaged: Bool
        var tags: [String: String]
    }
    
    // MARK: - Properties
    
    private let storageDirectory: URL
    private let awsCliPath: String
    private var trackedStates: [String: TrackedEnvironmentState] = [:] // key: "appId-environment"
    
    // MARK: - Initialization
    
    init() {
        self.storageDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("aws-state-tracking")
        self.awsCliPath = Self.findAwsCliPath()
        
        try? FileManager.default.createDirectory(at: storageDirectory, withIntermediateDirectories: true)
        
        Task { await loadPersistedStates() }
    }
    
    private static func findAwsCliPath() -> String {
        let paths = ["/opt/homebrew/bin/aws", "/usr/local/bin/aws", "/usr/bin/aws"]
        for path in paths { if FileManager.default.fileExists(atPath: path) { return path } }
        return "/usr/local/bin/aws"
    }
    
    // MARK: - Full State Extraction
    
    /// Extract complete AWS state for an environment
    func extractFullState(
        appId: String,
        environment: String,
        credentials: CredentialSet,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> TrackedEnvironmentState {
        let key = "\(appId)-\(environment)"
        let prefix = "radiant-\(appId)-\(environment.lowercased())"
        
        var state = TrackedEnvironmentState(
            appId: appId,
            environment: environment,
            region: credentials.region,
            lastFullSync: Date(),
            lastDeltaSync: nil,
            iamRoles: [],
            iamPolicies: [],
            securityGroups: [],
            secrets: [],
            parameters: [],
            eventBridgeRules: [],
            sqsQueues: [],
            snsTopics: [],
            cloudWatchAlarms: [],
            cloudWatchDashboards: [],
            apiGatewayApis: [],
            cognitoPools: [],
            stepFunctions: [],
            kinesisStreams: []
        )
        
        // Extract each resource type (14 types total)
        let totalSteps = 14.0
        var step = 0.0
        
        onProgress("Extracting IAM roles...", step / totalSteps)
        state.iamRoles = try await extractIAMRoles(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting IAM policies...", step / totalSteps)
        state.iamPolicies = try await extractIAMPolicies(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting security groups...", step / totalSteps)
        state.securityGroups = try await extractSecurityGroups(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting secrets...", step / totalSteps)
        state.secrets = try await extractSecrets(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting parameters...", step / totalSteps)
        state.parameters = try await extractParameters(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting EventBridge rules...", step / totalSteps)
        state.eventBridgeRules = try await extractEventBridgeRules(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting SQS queues...", step / totalSteps)
        state.sqsQueues = try await extractSQSQueues(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting SNS topics...", step / totalSteps)
        state.snsTopics = try await extractSNSTopics(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting CloudWatch alarms...", step / totalSteps)
        state.cloudWatchAlarms = try await extractCloudWatchAlarms(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting CloudWatch dashboards...", step / totalSteps)
        state.cloudWatchDashboards = try await extractCloudWatchDashboards(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting API Gateways...", step / totalSteps)
        state.apiGatewayApis = try await extractAPIGateways(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting Cognito pools...", step / totalSteps)
        state.cognitoPools = try await extractCognitoPools(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting Step Functions...", step / totalSteps)
        state.stepFunctions = try await extractStepFunctions(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Extracting Kinesis streams...", step / totalSteps)
        state.kinesisStreams = try await extractKinesisStreams(prefix: prefix, credentials: credentials)
        step += 1
        
        onProgress("Saving state...", 1.0)
        
        // Store and persist
        trackedStates[key] = state
        try await persistState(state, key: key)
        
        RadiantLogger.info("Extracted \(state.totalResources) AWS resources", category: RadiantLogger.aws)
        
        return state
    }
    
    // MARK: - Resource Extractors
    
    private func extractIAMRoles(prefix: String, credentials: CredentialSet) async throws -> [TrackedIAMRole] {
        let result = try await runAwsCommand(["iam", "list-roles", "--output", "json"], credentials: credentials)
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let roles = json["Roles"] as? [[String: Any]] else { return [] }
        
        return roles.compactMap { role -> TrackedIAMRole? in
            guard let roleName = role["RoleName"] as? String,
                  roleName.contains(prefix) || roleName.hasPrefix("Radiant") else { return nil }
            
            let dateFormatter = ISO8601DateFormatter()
            let createDateStr = role["CreateDate"] as? String ?? ""
            
            return TrackedIAMRole(
                id: role["Arn"] as? String ?? "",
                roleName: roleName,
                path: role["Path"] as? String ?? "/",
                assumeRolePolicyDocument: (role["AssumeRolePolicyDocument"] as? String) ?? "{}",
                attachedPolicies: [],
                inlinePolicies: [:],
                createDate: dateFormatter.date(from: createDateStr) ?? Date(),
                isRadiantManaged: roleName.contains("Radiant") || roleName.contains("CDK"),
                tags: [:]
            )
        }
    }
    
    private func extractIAMPolicies(prefix: String, credentials: CredentialSet) async throws -> [TrackedIAMPolicy] {
        let result = try await runAwsCommand(["iam", "list-policies", "--scope", "Local", "--output", "json"], credentials: credentials)
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let policies = json["Policies"] as? [[String: Any]] else { return [] }
        
        return policies.compactMap { policy -> TrackedIAMPolicy? in
            guard let policyName = policy["PolicyName"] as? String,
                  policyName.contains(prefix) || policyName.hasPrefix("Radiant") else { return nil }
            
            let dateFormatter = ISO8601DateFormatter()
            let createDateStr = policy["CreateDate"] as? String ?? ""
            
            return TrackedIAMPolicy(
                id: policy["Arn"] as? String ?? "",
                policyName: policyName,
                path: policy["Path"] as? String ?? "/",
                policyDocument: "", // Would need another call to get
                createDate: dateFormatter.date(from: createDateStr) ?? Date(),
                isRadiantManaged: policyName.contains("Radiant") || policyName.contains("CDK"),
                tags: [:]
            )
        }
    }
    
    private func extractSecurityGroups(prefix: String, credentials: CredentialSet) async throws -> [TrackedSecurityGroup] {
        let result = try await runAwsCommand([
            "ec2", "describe-security-groups",
            "--filters", "Name=tag:radiant-app,Values=*",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let groups = json["SecurityGroups"] as? [[String: Any]] else { return [] }
        
        return groups.compactMap { sg -> TrackedSecurityGroup? in
            let groupName = sg["GroupName"] as? String ?? ""
            guard groupName.contains(prefix) || groupName.hasPrefix("Radiant") else { return nil }
            
            var ingressRules: [SecurityGroupRule] = []
            if let perms = sg["IpPermissions"] as? [[String: Any]] {
                for perm in perms {
                    var cidrs: [String] = []
                    if let ranges = perm["IpRanges"] as? [[String: Any]] {
                        cidrs = ranges.compactMap { $0["CidrIp"] as? String }
                    }
                    ingressRules.append(SecurityGroupRule(
                        ipProtocol: perm["IpProtocol"] as? String ?? "-1",
                        fromPort: perm["FromPort"] as? Int,
                        toPort: perm["ToPort"] as? Int,
                        cidrBlocks: cidrs,
                        securityGroupIds: [],
                        description: nil
                    ))
                }
            }
            
            return TrackedSecurityGroup(
                id: sg["GroupId"] as? String ?? "",
                groupName: groupName,
                description: sg["Description"] as? String ?? "",
                vpcId: sg["VpcId"] as? String ?? "",
                ingressRules: ingressRules,
                egressRules: [],
                isRadiantManaged: groupName.contains("Radiant") || groupName.contains("CDK"),
                tags: [:]
            )
        }
    }
    
    private func extractSecrets(prefix: String, credentials: CredentialSet) async throws -> [TrackedSecret] {
        let result = try await runAwsCommand([
            "secretsmanager", "list-secrets",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let secrets = json["SecretList"] as? [[String: Any]] else { return [] }
        
        return secrets.compactMap { secret -> TrackedSecret? in
            let name = secret["Name"] as? String ?? ""
            guard name.contains(prefix) || name.hasPrefix("radiant") else { return nil }
            
            return TrackedSecret(
                id: secret["ARN"] as? String ?? "",
                name: name,
                description: secret["Description"] as? String,
                kmsKeyId: secret["KmsKeyId"] as? String,
                rotationEnabled: secret["RotationEnabled"] as? Bool ?? false,
                rotationLambdaArn: secret["RotationLambdaARN"] as? String,
                rotationRules: nil,
                tags: [:],
                isRadiantManaged: name.contains("radiant")
            )
        }
    }
    
    private func extractParameters(prefix: String, credentials: CredentialSet) async throws -> [TrackedParameter] {
        let result = try await runAwsCommand([
            "ssm", "describe-parameters",
            "--parameter-filters", "Key=Name,Values=/\(prefix)",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let params = json["Parameters"] as? [[String: Any]] else { return [] }
        
        return params.compactMap { param -> TrackedParameter? in
            let name = param["Name"] as? String ?? ""
            return TrackedParameter(
                id: name,
                name: name,
                type: param["Type"] as? String ?? "String",
                value: nil, // Don't store SecureString values
                description: param["Description"] as? String,
                tier: param["Tier"] as? String ?? "Standard",
                isRadiantManaged: name.contains("radiant"),
                tags: [:]
            )
        }
    }
    
    private func extractEventBridgeRules(prefix: String, credentials: CredentialSet) async throws -> [TrackedEventBridgeRule] {
        let result = try await runAwsCommand([
            "events", "list-rules",
            "--name-prefix", prefix,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let rules = json["Rules"] as? [[String: Any]] else { return [] }
        
        return rules.map { rule in
            TrackedEventBridgeRule(
                id: rule["Arn"] as? String ?? "",
                name: rule["Name"] as? String ?? "",
                eventBusName: rule["EventBusName"] as? String ?? "default",
                eventPattern: rule["EventPattern"] as? String,
                scheduleExpression: rule["ScheduleExpression"] as? String,
                state: rule["State"] as? String ?? "ENABLED",
                targets: [],
                isRadiantManaged: true,
                tags: [:]
            )
        }
    }
    
    private func extractSQSQueues(prefix: String, credentials: CredentialSet) async throws -> [TrackedSQSQueue] {
        let result = try await runAwsCommand([
            "sqs", "list-queues",
            "--queue-name-prefix", prefix,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let urls = json["QueueUrls"] as? [String] else { return [] }
        
        var queues: [TrackedSQSQueue] = []
        for url in urls {
            let queueName = url.components(separatedBy: "/").last ?? ""
            queues.append(TrackedSQSQueue(
                id: url,
                queueName: queueName,
                queueArn: "",
                visibilityTimeout: 30,
                messageRetentionPeriod: 345600,
                delaySeconds: 0,
                receiveMessageWaitTimeSeconds: 0,
                deadLetterTargetArn: nil,
                maxReceiveCount: nil,
                policy: nil,
                redrivePolicy: nil,
                isRadiantManaged: true,
                tags: [:]
            ))
        }
        return queues
    }
    
    private func extractSNSTopics(prefix: String, credentials: CredentialSet) async throws -> [TrackedSNSTopic] {
        let result = try await runAwsCommand([
            "sns", "list-topics",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let topics = json["Topics"] as? [[String: Any]] else { return [] }
        
        return topics.compactMap { topic -> TrackedSNSTopic? in
            let arn = topic["TopicArn"] as? String ?? ""
            let name = arn.components(separatedBy: ":").last ?? ""
            guard name.contains(prefix) else { return nil }
            
            return TrackedSNSTopic(
                id: arn,
                topicName: name,
                displayName: nil,
                policy: nil,
                deliveryPolicy: nil,
                subscriptions: [],
                isRadiantManaged: true,
                tags: [:]
            )
        }
    }
    
    private func extractCloudWatchAlarms(prefix: String, credentials: CredentialSet) async throws -> [TrackedCloudWatchAlarm] {
        let result = try await runAwsCommand([
            "cloudwatch", "describe-alarms",
            "--alarm-name-prefix", prefix,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let alarms = json["MetricAlarms"] as? [[String: Any]] else { return [] }
        
        return alarms.map { alarm in
            TrackedCloudWatchAlarm(
                id: alarm["AlarmArn"] as? String ?? "",
                alarmName: alarm["AlarmName"] as? String ?? "",
                alarmDescription: alarm["AlarmDescription"] as? String,
                metricName: alarm["MetricName"] as? String ?? "",
                namespace: alarm["Namespace"] as? String ?? "",
                statistic: alarm["Statistic"] as? String ?? "Average",
                period: alarm["Period"] as? Int ?? 300,
                evaluationPeriods: alarm["EvaluationPeriods"] as? Int ?? 1,
                threshold: alarm["Threshold"] as? Double ?? 0,
                comparisonOperator: alarm["ComparisonOperator"] as? String ?? "GreaterThanThreshold",
                alarmActions: alarm["AlarmActions"] as? [String] ?? [],
                okActions: alarm["OKActions"] as? [String] ?? [],
                insufficientDataActions: alarm["InsufficientDataActions"] as? [String] ?? [],
                dimensions: [:],
                isRadiantManaged: true,
                tags: [:]
            )
        }
    }
    
    private func extractCloudWatchDashboards(prefix: String, credentials: CredentialSet) async throws -> [TrackedCloudWatchDashboard] {
        let listResult = try await runAwsCommand([
            "cloudwatch", "list-dashboards",
            "--dashboard-name-prefix", prefix,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: listResult) as? [String: Any],
              let dashboards = json["DashboardEntries"] as? [[String: Any]] else { return [] }
        
        var trackedDashboards: [TrackedCloudWatchDashboard] = []
        
        for d in dashboards {
            let dashboardName = d["DashboardName"] as? String ?? ""
            
            // Fetch FULL dashboard body including all widgets
            var dashboardBody = "{}"
            do {
                let detailResult = try await runAwsCommand([
                    "cloudwatch", "get-dashboard",
                    "--dashboard-name", dashboardName,
                    "--region", credentials.region,
                    "--output", "json"
                ], credentials: credentials)
                
                if let detailJson = try? JSONSerialization.jsonObject(with: detailResult) as? [String: Any],
                   let body = detailJson["DashboardBody"] as? String {
                    dashboardBody = body
                }
            } catch {
                RadiantLogger.warning("Could not fetch dashboard body for \(dashboardName): \(error)", category: RadiantLogger.aws)
            }
            
            trackedDashboards.append(TrackedCloudWatchDashboard(
                id: dashboardName,
                dashboardName: dashboardName,
                dashboardBody: dashboardBody,
                isRadiantManaged: true
            ))
        }
        
        return trackedDashboards
    }
    
    private func extractAPIGateways(prefix: String, credentials: CredentialSet) async throws -> [TrackedAPIGateway] {
        let result = try await runAwsCommand([
            "apigatewayv2", "get-apis",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let apis = json["Items"] as? [[String: Any]] else { return [] }
        
        return apis.compactMap { api -> TrackedAPIGateway? in
            let name = api["Name"] as? String ?? ""
            guard name.contains(prefix) || name.hasPrefix("Radiant") else { return nil }
            
            return TrackedAPIGateway(
                id: api["ApiId"] as? String ?? "",
                name: name,
                apiType: api["ProtocolType"] as? String ?? "HTTP",
                description: api["Description"] as? String,
                endpointConfiguration: nil,
                stages: [],
                routes: [],
                authorizers: [],
                isRadiantManaged: true,
                tags: api["Tags"] as? [String: String] ?? [:]
            )
        }
    }
    
    private func extractCognitoPools(prefix: String, credentials: CredentialSet) async throws -> [TrackedCognitoPool] {
        let result = try await runAwsCommand([
            "cognito-idp", "list-user-pools",
            "--max-results", "60",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let pools = json["UserPools"] as? [[String: Any]] else { return [] }
        
        return pools.compactMap { pool -> TrackedCognitoPool? in
            let name = pool["Name"] as? String ?? ""
            guard name.contains(prefix) || name.hasPrefix("Radiant") else { return nil }
            
            return TrackedCognitoPool(
                id: pool["Id"] as? String ?? "",
                poolName: name,
                poolArn: "",
                autoVerifiedAttributes: [],
                usernameAttributes: [],
                mfaConfiguration: "OFF",
                passwordPolicy: nil,
                lambdaTriggers: [:],
                appClients: [],
                isRadiantManaged: true,
                tags: [:]
            )
        }
    }
    
    private func extractStepFunctions(prefix: String, credentials: CredentialSet) async throws -> [TrackedStepFunction] {
        let result = try await runAwsCommand([
            "stepfunctions", "list-state-machines",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let machines = json["stateMachines"] as? [[String: Any]] else { return [] }
        
        return machines.compactMap { sm -> TrackedStepFunction? in
            let name = sm["name"] as? String ?? ""
            guard name.contains(prefix) || name.hasPrefix("Radiant") else { return nil }
            
            return TrackedStepFunction(
                id: sm["stateMachineArn"] as? String ?? "",
                name: name,
                stateMachineType: sm["type"] as? String ?? "STANDARD",
                definition: "{}",
                roleArn: "",
                loggingConfiguration: nil,
                tracingConfiguration: nil,
                isRadiantManaged: true,
                tags: [:]
            )
        }
    }
    
    private func extractKinesisStreams(prefix: String, credentials: CredentialSet) async throws -> [TrackedKinesisStream] {
        let result = try await runAwsCommand([
            "kinesis", "list-streams",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let names = json["StreamNames"] as? [String] else { return [] }
        
        return names.compactMap { name -> TrackedKinesisStream? in
            guard name.contains(prefix) else { return nil }
            
            return TrackedKinesisStream(
                id: "",
                streamName: name,
                shardCount: 1,
                retentionPeriodHours: 24,
                encryptionType: nil,
                kmsKeyId: nil,
                isRadiantManaged: true,
                tags: [:]
            )
        }
    }
    
    // MARK: - Persistence
    
    private func loadPersistedStates() async {
        guard let files = try? FileManager.default.contentsOfDirectory(at: storageDirectory, includingPropertiesForKeys: nil) else { return }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        for file in files where file.pathExtension == "json" {
            if let data = try? Data(contentsOf: file),
               let state = try? decoder.decode(TrackedEnvironmentState.self, from: data) {
                let key = "\(state.appId)-\(state.environment)"
                trackedStates[key] = state
            }
        }
        
        RadiantLogger.info("Loaded \(trackedStates.count) persisted AWS states", category: RadiantLogger.aws)
    }
    
    private func persistState(_ state: TrackedEnvironmentState, key: String) async throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        
        let data = try encoder.encode(state)
        let file = storageDirectory.appendingPathComponent("\(key).json")
        try data.write(to: file)
    }
    
    // MARK: - AWS CLI Helper
    
    private func runAwsCommand(_ arguments: [String], credentials: CredentialSet) async throws -> Data {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = arguments
        
        var env = ProcessInfo.processInfo.environment
        env["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        env["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        env["AWS_DEFAULT_REGION"] = credentials.region
        process.environment = env
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        return outputPipe.fileHandleForReading.readDataToEndOfFile()
    }
    
    // MARK: - Public API
    
    func getTrackedState(appId: String, environment: String) -> TrackedEnvironmentState? {
        trackedStates["\(appId)-\(environment)"]
    }
    
    func listTrackedEnvironments() -> [String] {
        Array(trackedStates.keys)
    }
}

// MARK: - Singleton

extension AWSStateTracker {
    static let shared = AWSStateTracker()
}

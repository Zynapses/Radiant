// RADIANT - CDK Code Generator
// Generates TypeScript CDK code from tracked AWS state
// This enables bi-directional sync: AWS resources → CDK code → redeployable

import Foundation

actor CDKCodeGenerator {
    
    // MARK: - Types
    
    struct GeneratedCDKCode: Codable, Sendable {
        let generatedAt: Date
        let appId: String
        let environment: String
        let outputPath: URL
        
        var stackFiles: [GeneratedFile]
        var constructFiles: [GeneratedFile]
        var totalLinesOfCode: Int
        var resourceCounts: [String: Int]
    }
    
    struct GeneratedFile: Codable, Sendable {
        let filename: String
        let path: String
        let content: String
        let resourceType: String
        let resourceCount: Int
    }
    
    // MARK: - Properties
    
    private let outputDirectory: URL
    
    // MARK: - Initialization
    
    init() {
        self.outputDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("generated-cdk")
        
        try? FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
    }
    
    // MARK: - Main Generation
    
    /// Generate CDK code from tracked AWS state
    func generateCDKCode(
        from state: AWSStateTracker.TrackedEnvironmentState,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> GeneratedCDKCode {
        let packageDir = outputDirectory.appendingPathComponent("\(state.appId)-\(state.environment)-\(Int(Date().timeIntervalSince1970))")
        try FileManager.default.createDirectory(at: packageDir, withIntermediateDirectories: true)
        
        var generatedFiles: [GeneratedFile] = []
        var constructFiles: [GeneratedFile] = []
        var totalLines = 0
        
        let totalSteps = 10.0
        var step = 0.0
        
        // Generate IAM constructs
        onProgress("Generating IAM constructs...", step / totalSteps)
        if !state.iamRoles.isEmpty || !state.iamPolicies.isEmpty {
            let iamFile = generateIAMConstruct(roles: state.iamRoles, policies: state.iamPolicies, appId: state.appId)
            try iamFile.content.write(to: packageDir.appendingPathComponent(iamFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(iamFile)
            totalLines += iamFile.content.components(separatedBy: "\n").count
        }
        step += 1
        
        // Generate Security Group constructs
        onProgress("Generating Security Group constructs...", step / totalSteps)
        if !state.securityGroups.isEmpty {
            let sgFile = generateSecurityGroupConstruct(securityGroups: state.securityGroups, appId: state.appId)
            try sgFile.content.write(to: packageDir.appendingPathComponent(sgFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(sgFile)
            totalLines += sgFile.content.components(separatedBy: "\n").count
        }
        step += 1
        
        // Generate Secrets constructs
        onProgress("Generating Secrets constructs...", step / totalSteps)
        if !state.secrets.isEmpty {
            let secretsFile = generateSecretsConstruct(secrets: state.secrets, appId: state.appId)
            try secretsFile.content.write(to: packageDir.appendingPathComponent(secretsFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(secretsFile)
            totalLines += secretsFile.content.components(separatedBy: "\n").count
        }
        step += 1
        
        // Generate EventBridge constructs
        onProgress("Generating EventBridge constructs...", step / totalSteps)
        if !state.eventBridgeRules.isEmpty {
            let eventsFile = generateEventBridgeConstruct(rules: state.eventBridgeRules, appId: state.appId)
            try eventsFile.content.write(to: packageDir.appendingPathComponent(eventsFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(eventsFile)
            totalLines += eventsFile.content.components(separatedBy: "\n").count
        }
        step += 1
        
        // Generate SQS constructs
        onProgress("Generating SQS constructs...", step / totalSteps)
        if !state.sqsQueues.isEmpty {
            let sqsFile = generateSQSConstruct(queues: state.sqsQueues, appId: state.appId)
            try sqsFile.content.write(to: packageDir.appendingPathComponent(sqsFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(sqsFile)
            totalLines += sqsFile.content.components(separatedBy: "\n").count
        }
        step += 1
        
        // Generate SNS constructs
        onProgress("Generating SNS constructs...", step / totalSteps)
        if !state.snsTopics.isEmpty {
            let snsFile = generateSNSConstruct(topics: state.snsTopics, appId: state.appId)
            try snsFile.content.write(to: packageDir.appendingPathComponent(snsFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(snsFile)
            totalLines += snsFile.content.components(separatedBy: "\n").count
        }
        step += 1
        
        // Generate CloudWatch constructs
        onProgress("Generating CloudWatch constructs...", step / totalSteps)
        if !state.cloudWatchAlarms.isEmpty || !state.cloudWatchDashboards.isEmpty {
            let cwFile = generateCloudWatchConstruct(alarms: state.cloudWatchAlarms, dashboards: state.cloudWatchDashboards, appId: state.appId)
            try cwFile.content.write(to: packageDir.appendingPathComponent(cwFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(cwFile)
            totalLines += cwFile.content.components(separatedBy: "\n").count
        }
        step += 1
        
        // Generate Step Functions constructs
        onProgress("Generating Step Functions constructs...", step / totalSteps)
        if !state.stepFunctions.isEmpty {
            let sfFile = generateStepFunctionsConstruct(stateMachines: state.stepFunctions, appId: state.appId)
            try sfFile.content.write(to: packageDir.appendingPathComponent(sfFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(sfFile)
            totalLines += sfFile.content.components(separatedBy: "\n").count
        }
        step += 1
        
        // Generate API Gateway constructs with dynamic Lambda ARN resolution
        onProgress("Generating API Gateway constructs...", step / totalSteps)
        if !state.apiGatewayApis.isEmpty {
            let apiFile = generateAPIGatewayConstruct(apis: state.apiGatewayApis, appId: state.appId)
            try apiFile.content.write(to: packageDir.appendingPathComponent(apiFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(apiFile)
            totalLines += apiFile.content.components(separatedBy: "\n").count
        }
        
        // Generate Cognito constructs with dynamic Lambda trigger resolution
        onProgress("Generating Cognito constructs...", step / totalSteps)
        if !state.cognitoPools.isEmpty {
            let cognitoFile = generateCognitoConstruct(pools: state.cognitoPools, appId: state.appId)
            try cognitoFile.content.write(to: packageDir.appendingPathComponent(cognitoFile.filename), atomically: true, encoding: .utf8)
            constructFiles.append(cognitoFile)
            totalLines += cognitoFile.content.components(separatedBy: "\n").count
        }
        
        // Generate main stack that combines all constructs
        onProgress("Generating main stack...", step / totalSteps)
        let mainStackFile = generateMainStack(state: state, constructs: constructFiles)
        try mainStackFile.content.write(to: packageDir.appendingPathComponent(mainStackFile.filename), atomically: true, encoding: .utf8)
        generatedFiles.append(mainStackFile)
        totalLines += mainStackFile.content.components(separatedBy: "\n").count
        step += 1
        
        // Generate index file
        onProgress("Generating index file...", step / totalSteps)
        let indexFile = generateIndexFile(constructs: constructFiles, mainStack: mainStackFile)
        try indexFile.content.write(to: packageDir.appendingPathComponent(indexFile.filename), atomically: true, encoding: .utf8)
        generatedFiles.append(indexFile)
        totalLines += indexFile.content.components(separatedBy: "\n").count
        
        onProgress("CDK generation complete!", 1.0)
        
        return GeneratedCDKCode(
            generatedAt: Date(),
            appId: state.appId,
            environment: state.environment,
            outputPath: packageDir,
            stackFiles: generatedFiles,
            constructFiles: constructFiles,
            totalLinesOfCode: totalLines,
            resourceCounts: state.resourceCounts
        )
    }
    
    // MARK: - IAM Generation
    
    private func generateIAMConstruct(roles: [AWSStateTracker.TrackedIAMRole], policies: [AWSStateTracker.TrackedIAMPolicy], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated IAM Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        
        import * as cdk from 'aws-cdk-lib';
        import * as iam from 'aws-cdk-lib/aws-iam';
        import { Construct } from 'constructs';
        
        export interface ExtractedIAMProps {
          appId: string;
          environment: string;
        }
        
        export class ExtractedIAMConstruct extends Construct {
          public readonly roles: Map<string, iam.Role> = new Map();
          public readonly policies: Map<string, iam.ManagedPolicy> = new Map();
          
          constructor(scope: Construct, id: string, props: ExtractedIAMProps) {
            super(scope, id);
        
        """
        
        // Generate roles
        for role in roles where !role.isRadiantManaged {
            let safeName = role.roleName.replacingOccurrences(of: "-", with: "")
            code += """
            
                // Role: \(role.roleName)
                const \(safeName)Role = new iam.Role(this, '\(role.roleName)', {
                  roleName: '\(role.roleName)',
                  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
                  path: '\(role.path)',
                });
                this.roles.set('\(role.roleName)', \(safeName)Role);
            
            """
        }
        
        // Generate policies
        for policy in policies where !policy.isRadiantManaged {
            let safeName = policy.policyName.replacingOccurrences(of: "-", with: "")
            code += """
            
                // Policy: \(policy.policyName)
                const \(safeName)Policy = new iam.ManagedPolicy(this, '\(policy.policyName)', {
                  managedPolicyName: '\(policy.policyName)',
                  path: '\(policy.path)',
                });
                this.policies.set('\(policy.policyName)', \(safeName)Policy);
            
            """
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-iam.construct.ts",
            path: "lib/constructs/extracted-iam.construct.ts",
            content: code,
            resourceType: "IAM",
            resourceCount: roles.count + policies.count
        )
    }
    
    // MARK: - Security Group Generation
    
    private func generateSecurityGroupConstruct(securityGroups: [AWSStateTracker.TrackedSecurityGroup], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated Security Group Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        
        import * as cdk from 'aws-cdk-lib';
        import * as ec2 from 'aws-cdk-lib/aws-ec2';
        import { Construct } from 'constructs';
        
        export interface ExtractedSecurityGroupProps {
          vpc: ec2.IVpc;
        }
        
        export class ExtractedSecurityGroupConstruct extends Construct {
          public readonly securityGroups: Map<string, ec2.SecurityGroup> = new Map();
          
          constructor(scope: Construct, id: string, props: ExtractedSecurityGroupProps) {
            super(scope, id);
        
        """
        
        for sg in securityGroups where !sg.isRadiantManaged {
            let safeName = sg.groupName.replacingOccurrences(of: "-", with: "")
            code += """
            
                // Security Group: \(sg.groupName)
                const \(safeName)SG = new ec2.SecurityGroup(this, '\(sg.groupName)', {
                  vpc: props.vpc,
                  securityGroupName: '\(sg.groupName)',
                  description: '\(sg.description.replacingOccurrences(of: "'", with: "\\'"))',
                  allowAllOutbound: true,
                });
            
            """
            
            // Add ingress rules
            for rule in sg.ingressRules {
                for cidr in rule.cidrBlocks {
                    let port = rule.fromPort ?? 0
                    code += """
                        \(safeName)SG.addIngressRule(
                          ec2.Peer.ipv4('\(cidr)'),
                          ec2.Port.tcp(\(port)),
                          '\(rule.description ?? "Extracted rule")'
                        );
                    
                    """
                }
            }
            
            code += """
                this.securityGroups.set('\(sg.groupName)', \(safeName)SG);
            
            """
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-security-groups.construct.ts",
            path: "lib/constructs/extracted-security-groups.construct.ts",
            content: code,
            resourceType: "SecurityGroup",
            resourceCount: securityGroups.count
        )
    }
    
    // MARK: - Secrets Generation
    
    private func generateSecretsConstruct(secrets: [AWSStateTracker.TrackedSecret], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated Secrets Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        // NOTE: Secret VALUES are not stored - only metadata. You must manually set secret values.
        
        import * as cdk from 'aws-cdk-lib';
        import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
        import { Construct } from 'constructs';
        
        export class ExtractedSecretsConstruct extends Construct {
          public readonly secrets: Map<string, secretsmanager.Secret> = new Map();
          
          constructor(scope: Construct, id: string) {
            super(scope, id);
        
        """
        
        for secret in secrets where !secret.isRadiantManaged {
            let safeName = secret.name
                .replacingOccurrences(of: "-", with: "")
                .replacingOccurrences(of: "/", with: "")
            code += """
            
                // Secret: \(secret.name)
                // ⚠️ You must manually set the secret value after deployment
                const \(safeName)Secret = new secretsmanager.Secret(this, '\(safeName)', {
                  secretName: '\(secret.name)',
                  description: '\(secret.description ?? "Extracted secret")',
                });
                this.secrets.set('\(secret.name)', \(safeName)Secret);
            
            """
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-secrets.construct.ts",
            path: "lib/constructs/extracted-secrets.construct.ts",
            content: code,
            resourceType: "Secret",
            resourceCount: secrets.count
        )
    }
    
    // MARK: - EventBridge Generation
    
    private func generateEventBridgeConstruct(rules: [AWSStateTracker.TrackedEventBridgeRule], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated EventBridge Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        
        import * as cdk from 'aws-cdk-lib';
        import * as events from 'aws-cdk-lib/aws-events';
        import * as targets from 'aws-cdk-lib/aws-events-targets';
        import { Construct } from 'constructs';
        
        export class ExtractedEventBridgeConstruct extends Construct {
          public readonly rules: Map<string, events.Rule> = new Map();
          
          constructor(scope: Construct, id: string) {
            super(scope, id);
        
        """
        
        for rule in rules where !rule.isRadiantManaged {
            let safeName = rule.name.replacingOccurrences(of: "-", with: "")
            code += """
            
                // Rule: \(rule.name)
                const \(safeName)Rule = new events.Rule(this, '\(rule.name)', {
                  ruleName: '\(rule.name)',
            """
            
            if let schedule = rule.scheduleExpression {
                code += """
                      schedule: events.Schedule.expression('\(schedule)'),
                """
            }
            
            if let pattern = rule.eventPattern {
                code += """
                      eventPattern: \(pattern),
                """
            }
            
            code += """
                  enabled: \(rule.state == "ENABLED"),
                });
                this.rules.set('\(rule.name)', \(safeName)Rule);
            
            """
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-eventbridge.construct.ts",
            path: "lib/constructs/extracted-eventbridge.construct.ts",
            content: code,
            resourceType: "EventBridge",
            resourceCount: rules.count
        )
    }
    
    // MARK: - SQS Generation
    
    private func generateSQSConstruct(queues: [AWSStateTracker.TrackedSQSQueue], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated SQS Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        
        import * as cdk from 'aws-cdk-lib';
        import * as sqs from 'aws-cdk-lib/aws-sqs';
        import { Construct } from 'constructs';
        
        export class ExtractedSQSConstruct extends Construct {
          public readonly queues: Map<string, sqs.Queue> = new Map();
          
          constructor(scope: Construct, id: string) {
            super(scope, id);
        
        """
        
        for queue in queues where !queue.isRadiantManaged {
            let safeName = queue.queueName.replacingOccurrences(of: "-", with: "")
            code += """
            
                // Queue: \(queue.queueName)
                const \(safeName)Queue = new sqs.Queue(this, '\(queue.queueName)', {
                  queueName: '\(queue.queueName)',
                  visibilityTimeout: cdk.Duration.seconds(\(queue.visibilityTimeout)),
                  retentionPeriod: cdk.Duration.seconds(\(queue.messageRetentionPeriod)),
                  deliveryDelay: cdk.Duration.seconds(\(queue.delaySeconds)),
                  receiveMessageWaitTime: cdk.Duration.seconds(\(queue.receiveMessageWaitTimeSeconds)),
                });
                this.queues.set('\(queue.queueName)', \(safeName)Queue);
            
            """
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-sqs.construct.ts",
            path: "lib/constructs/extracted-sqs.construct.ts",
            content: code,
            resourceType: "SQS",
            resourceCount: queues.count
        )
    }
    
    // MARK: - SNS Generation
    
    private func generateSNSConstruct(topics: [AWSStateTracker.TrackedSNSTopic], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated SNS Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        
        import * as cdk from 'aws-cdk-lib';
        import * as sns from 'aws-cdk-lib/aws-sns';
        import { Construct } from 'constructs';
        
        export class ExtractedSNSConstruct extends Construct {
          public readonly topics: Map<string, sns.Topic> = new Map();
          
          constructor(scope: Construct, id: string) {
            super(scope, id);
        
        """
        
        for topic in topics where !topic.isRadiantManaged {
            let safeName = topic.topicName.replacingOccurrences(of: "-", with: "")
            code += """
            
                // Topic: \(topic.topicName)
                const \(safeName)Topic = new sns.Topic(this, '\(topic.topicName)', {
                  topicName: '\(topic.topicName)',
                  displayName: '\(topic.displayName ?? topic.topicName)',
                });
                this.topics.set('\(topic.topicName)', \(safeName)Topic);
            
            """
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-sns.construct.ts",
            path: "lib/constructs/extracted-sns.construct.ts",
            content: code,
            resourceType: "SNS",
            resourceCount: topics.count
        )
    }
    
    // MARK: - CloudWatch Generation
    
    private func generateCloudWatchConstruct(alarms: [AWSStateTracker.TrackedCloudWatchAlarm], dashboards: [AWSStateTracker.TrackedCloudWatchDashboard], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated CloudWatch Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        
        import * as cdk from 'aws-cdk-lib';
        import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
        import { Construct } from 'constructs';
        
        export class ExtractedCloudWatchConstruct extends Construct {
          public readonly alarms: Map<string, cloudwatch.Alarm> = new Map();
          public readonly dashboards: Map<string, cloudwatch.Dashboard> = new Map();
          
          constructor(scope: Construct, id: string) {
            super(scope, id);
        
        """
        
        // Generate alarms
        for alarm in alarms where !alarm.isRadiantManaged {
            let safeName = alarm.alarmName.replacingOccurrences(of: "-", with: "")
            code += """
            
                // Alarm: \(alarm.alarmName)
                const \(safeName)Metric = new cloudwatch.Metric({
                  namespace: '\(alarm.namespace)',
                  metricName: '\(alarm.metricName)',
                  statistic: '\(alarm.statistic)',
                  period: cdk.Duration.seconds(\(alarm.period)),
                });
                
                const \(safeName)Alarm = new cloudwatch.Alarm(this, '\(alarm.alarmName)', {
                  alarmName: '\(alarm.alarmName)',
                  alarmDescription: '\(alarm.alarmDescription ?? "")',
                  metric: \(safeName)Metric,
                  threshold: \(alarm.threshold),
                  evaluationPeriods: \(alarm.evaluationPeriods),
                  comparisonOperator: cloudwatch.ComparisonOperator.\(mapComparisonOperator(alarm.comparisonOperator)),
                });
                this.alarms.set('\(alarm.alarmName)', \(safeName)Alarm);
            
            """
        }
        
        // Generate dashboards with FULL widget JSON
        for dashboard in dashboards where !dashboard.isRadiantManaged {
            let safeName = dashboard.dashboardName.replacingOccurrences(of: "-", with: "")
            
            // Escape the dashboard body JSON for TypeScript string literal
            let escapedBody = dashboard.dashboardBody
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "`", with: "\\`")
                .replacingOccurrences(of: "$", with: "\\$")
            
            code += """
            
                // Dashboard: \(dashboard.dashboardName)
                // ✅ FULL widget replication from captured dashboard body
                const \(safeName)DashboardBody = `\(escapedBody)`;
                
                // Parse and create dashboard with all widgets
                const \(safeName)Dashboard = new cloudwatch.CfnDashboard(this, '\(dashboard.dashboardName)', {
                  dashboardName: '\(dashboard.dashboardName)',
                  dashboardBody: \(safeName)DashboardBody,
                });
                
                // Also create a CDK Dashboard wrapper for programmatic access
                const \(safeName)DashboardWrapper = new cloudwatch.Dashboard(this, '\(dashboard.dashboardName)Wrapper', {
                  dashboardName: '\(dashboard.dashboardName)-cdk',
                });
                this.dashboards.set('\(dashboard.dashboardName)', \(safeName)DashboardWrapper);
            
            """
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-cloudwatch.construct.ts",
            path: "lib/constructs/extracted-cloudwatch.construct.ts",
            content: code,
            resourceType: "CloudWatch",
            resourceCount: alarms.count + dashboards.count
        )
    }
    
    private func mapComparisonOperator(_ op: String) -> String {
        switch op {
        case "GreaterThanThreshold": return "GREATER_THAN_THRESHOLD"
        case "GreaterThanOrEqualToThreshold": return "GREATER_THAN_OR_EQUAL_TO_THRESHOLD"
        case "LessThanThreshold": return "LESS_THAN_THRESHOLD"
        case "LessThanOrEqualToThreshold": return "LESS_THAN_OR_EQUAL_TO_THRESHOLD"
        default: return "GREATER_THAN_THRESHOLD"
        }
    }
    
    // MARK: - Step Functions Generation
    
    private func generateStepFunctionsConstruct(stateMachines: [AWSStateTracker.TrackedStepFunction], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated Step Functions Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        
        import * as cdk from 'aws-cdk-lib';
        import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
        import * as iam from 'aws-cdk-lib/aws-iam';
        import { Construct } from 'constructs';
        
        export class ExtractedStepFunctionsConstruct extends Construct {
          public readonly stateMachines: Map<string, sfn.StateMachine> = new Map();
          
          constructor(scope: Construct, id: string) {
            super(scope, id);
        
        """
        
        for sm in stateMachines where !sm.isRadiantManaged {
            let safeName = sm.name.replacingOccurrences(of: "-", with: "")
            code += """
            
                // State Machine: \(sm.name)
                const \(safeName)Definition = sfn.DefinitionBody.fromString(`\(sm.definition)`);
                
                const \(safeName)SM = new sfn.StateMachine(this, '\(sm.name)', {
                  stateMachineName: '\(sm.name)',
                  definitionBody: \(safeName)Definition,
                  stateMachineType: sfn.StateMachineType.\(sm.stateMachineType == "EXPRESS" ? "EXPRESS" : "STANDARD"),
                });
                this.stateMachines.set('\(sm.name)', \(safeName)SM);
            
            """
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-stepfunctions.construct.ts",
            path: "lib/constructs/extracted-stepfunctions.construct.ts",
            content: code,
            resourceType: "StepFunctions",
            resourceCount: stateMachines.count
        )
    }
    
    // MARK: - Main Stack Generation
    
    private func generateMainStack(state: AWSStateTracker.TrackedEnvironmentState, constructs: [GeneratedFile]) -> GeneratedFile {
        var imports = ""
        var instantiations = ""
        
        for construct in constructs {
            let className = construct.filename
                .replacingOccurrences(of: ".construct.ts", with: "")
                .split(separator: "-")
                .map { $0.capitalized }
                .joined() + "Construct"
            
            imports += "import { Extracted\(construct.resourceType)Construct } from './constructs/\(construct.filename.replacingOccurrences(of: ".ts", with: ""))';\n"
            instantiations += "    new Extracted\(construct.resourceType)Construct(this, 'Extracted\(construct.resourceType)');\n"
        }
        
        let code = """
        // Auto-generated Main Stack from AWS State Extraction
        // App: \(state.appId) | Environment: \(state.environment)
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        // Total Resources: \(state.totalResources)
        
        import * as cdk from 'aws-cdk-lib';
        import { Construct } from 'constructs';
        \(imports)
        
        export interface ExtractedResourcesStackProps extends cdk.StackProps {
          appId: string;
          environment: string;
        }
        
        export class ExtractedResourcesStack extends cdk.Stack {
          constructor(scope: Construct, id: string, props: ExtractedResourcesStackProps) {
            super(scope, id, props);
            
            // Resource counts extracted:
        \(state.resourceCounts.map { "    // - \($0.key): \($0.value)" }.joined(separator: "\n"))
            
            // Instantiate all extracted constructs
        \(instantiations)
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-resources.stack.ts",
            path: "lib/extracted-resources.stack.ts",
            content: code,
            resourceType: "Stack",
            resourceCount: state.totalResources
        )
    }
    
    // MARK: - Index File Generation
    
    private func generateIndexFile(constructs: [GeneratedFile], mainStack: GeneratedFile) -> GeneratedFile {
        var exports = "// Auto-generated index file\n\n"
        
        exports += "export { ExtractedResourcesStack } from './lib/extracted-resources.stack';\n"
        
        for construct in constructs {
            let filename = construct.filename.replacingOccurrences(of: ".ts", with: "")
            exports += "export * from './lib/constructs/\(filename)';\n"
        }
        
        return GeneratedFile(
            filename: "index.ts",
            path: "index.ts",
            content: exports,
            resourceType: "Index",
            resourceCount: 0
        )
    }
    
    // MARK: - API Gateway Generation (with Dynamic Lambda ARN Resolution)
    
    private func generateAPIGatewayConstruct(apis: [AWSStateTracker.TrackedAPIGateway], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated API Gateway Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        // ✅ FULL SUPPORT: Uses dynamic Lambda ARN resolution for authorizers
        
        import * as cdk from 'aws-cdk-lib';
        import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
        import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
        import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
        import * as lambda from 'aws-cdk-lib/aws-lambda';
        import { Construct } from 'constructs';
        
        export interface ExtractedAPIGatewayProps {
          // Map of Lambda function names to IFunction references
          // Pass your existing Lambda functions here for dynamic ARN resolution
          lambdaFunctions?: Map<string, lambda.IFunction>;
        }
        
        export class ExtractedAPIGatewayConstruct extends Construct {
          public readonly apis: Map<string, apigatewayv2.HttpApi> = new Map();
          public readonly authorizers: Map<string, apigatewayv2.IHttpRouteAuthorizer> = new Map();
          
          constructor(scope: Construct, id: string, props: ExtractedAPIGatewayProps = {}) {
            super(scope, id);
            
            const lambdaFunctions = props.lambdaFunctions || new Map();
        
        """
        
        for api in apis where !api.isRadiantManaged {
            let safeName = api.name.replacingOccurrences(of: "-", with: "")
            code += """
            
                // API: \(api.name) (Type: \(api.apiType))
                const \(safeName)Api = new apigatewayv2.HttpApi(this, '\(api.name)', {
                  apiName: '\(api.name)',
                  description: '\(api.description ?? "Extracted from AWS")',
                });
                this.apis.set('\(api.name)', \(safeName)Api);
            
            """
            
            // Generate authorizers with dynamic Lambda resolution
            for authorizer in api.authorizers {
                if let functionName = authorizer.lambdaFunctionName {
                    let authSafeName = authorizer.name.replacingOccurrences(of: "-", with: "")
                    code += """
                    
                        // Authorizer: \(authorizer.name) (Lambda: \(functionName))
                        // Dynamic Lambda ARN resolution - looks up function by name
                        const \(authSafeName)Function = lambdaFunctions.get('\(functionName)') 
                          || lambda.Function.fromFunctionName(this, '\(authSafeName)LambdaLookup', '\(functionName)');
                        
                        const \(authSafeName)Authorizer = new apigatewayv2Authorizers.HttpLambdaAuthorizer(
                          '\(authorizer.name)',
                          \(authSafeName)Function,
                          {
                            authorizerName: '\(authorizer.name)',
                            identitySource: [\(authorizer.identitySource.map { "'\($0)'" }.joined(separator: ", "))],
                            responseTypes: [apigatewayv2Authorizers.HttpLambdaResponseType.SIMPLE],
                          }
                        );
                        this.authorizers.set('\(authorizer.name)', \(authSafeName)Authorizer);
                    
                    """
                }
            }
            
            // Generate routes with Lambda integrations
            for route in api.routes {
                let routeSafeName = route.routeKey
                    .replacingOccurrences(of: " ", with: "_")
                    .replacingOccurrences(of: "/", with: "_")
                    .replacingOccurrences(of: "{", with: "")
                    .replacingOccurrences(of: "}", with: "")
                    .replacingOccurrences(of: "-", with: "_")
                
                if let lambdaName = route.lambdaFunctionName {
                    // Route has a Lambda integration - generate full integration code
                    code += """
                    
                        // Route: \(route.routeKey) -> Lambda: \(lambdaName)
                        const \(safeName)_\(routeSafeName)_Lambda = lambdaFunctions.get('\(lambdaName)')
                          || lambda.Function.fromFunctionName(this, '\(safeName)\(routeSafeName)LambdaLookup', '\(lambdaName)');
                        
                        \(safeName)Api.addRoutes({
                          path: '\(route.path)',
                          methods: [apigatewayv2.HttpMethod.\(route.httpMethod.uppercased())],
                          integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                            '\(safeName)\(routeSafeName)Integration',
                            \(safeName)_\(routeSafeName)_Lambda
                          ),
                    """
                    
                    // Add authorizer if present
                    if let authorizerId = route.authorizerId, !authorizerId.isEmpty {
                        code += """
                          authorizer: this.authorizers.get('\(authorizerId)'),
                        """
                    }
                    
                    code += """
                        });
                    
                    """
                } else if let target = route.target, target.hasPrefix("integrations/") {
                    // Route uses an integration ID - generate placeholder with lookup comment
                    let integrationId = target.replacingOccurrences(of: "integrations/", with: "")
                    code += """
                    
                        // Route: \(route.routeKey) (Integration ID: \(integrationId))
                        // NOTE: This route uses an API Gateway integration. The Lambda function 
                        // must be passed via lambdaFunctions map or looked up by integration ID.
                        // Integration ID '\(integrationId)' should map to your target Lambda function.
                        const \(safeName)_\(routeSafeName)_Lambda = lambdaFunctions.get('\(integrationId)')
                          || (() => {
                            console.warn('Integration \(integrationId) not found in lambdaFunctions map');
                            return undefined;
                          })();
                        
                        if (\(safeName)_\(routeSafeName)_Lambda) {
                          \(safeName)Api.addRoutes({
                            path: '\(route.path)',
                            methods: [apigatewayv2.HttpMethod.\(route.httpMethod.uppercased())],
                            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                              '\(safeName)\(routeSafeName)Integration',
                              \(safeName)_\(routeSafeName)_Lambda
                            ),
                    """
                    
                    if let authorizerId = route.authorizerId, !authorizerId.isEmpty {
                        code += """
                            authorizer: this.authorizers.get('\(authorizerId)'),
                        """
                    }
                    
                    code += """
                          });
                        }
                    
                    """
                } else {
                    // Unknown integration type - generate comment only
                    code += """
                    
                        // Route: \(route.routeKey)
                        // WARNING: Could not determine Lambda integration target.
                        // Please manually configure this route's integration.
                        // Target: \(route.target ?? "none")
                    
                    """
                }
            }
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-apigateway.construct.ts",
            path: "lib/constructs/extracted-apigateway.construct.ts",
            content: code,
            resourceType: "APIGateway",
            resourceCount: apis.count
        )
    }
    
    // MARK: - Cognito Generation (with Dynamic Lambda Trigger Resolution)
    
    private func generateCognitoConstruct(pools: [AWSStateTracker.TrackedCognitoPool], appId: String) -> GeneratedFile {
        var code = """
        // Auto-generated Cognito Construct from AWS State Extraction
        // Generated: \(ISO8601DateFormatter().string(from: Date()))
        // ✅ FULL SUPPORT: Uses dynamic Lambda ARN resolution for triggers
        
        import * as cdk from 'aws-cdk-lib';
        import * as cognito from 'aws-cdk-lib/aws-cognito';
        import * as lambda from 'aws-cdk-lib/aws-lambda';
        import { Construct } from 'constructs';
        
        export interface ExtractedCognitoProps {
          // Map of Lambda function names to IFunction references
          // Pass your existing Lambda functions here for dynamic ARN resolution
          lambdaFunctions?: Map<string, lambda.IFunction>;
        }
        
        export class ExtractedCognitoConstruct extends Construct {
          public readonly userPools: Map<string, cognito.UserPool> = new Map();
          public readonly userPoolClients: Map<string, cognito.UserPoolClient> = new Map();
          
          constructor(scope: Construct, id: string, props: ExtractedCognitoProps = {}) {
            super(scope, id);
            
            const lambdaFunctions = props.lambdaFunctions || new Map();
        
        """
        
        for pool in pools where !pool.isRadiantManaged {
            let safeName = pool.poolName.replacingOccurrences(of: "-", with: "")
            
            // Build Lambda triggers object with dynamic resolution
            let triggerFunctionNames = pool.lambdaTriggerFunctionNames
            var triggersCode = ""
            
            if !triggerFunctionNames.isEmpty {
                triggersCode = """
                
                    // Lambda triggers with dynamic ARN resolution
                    const \(safeName)Triggers: cognito.UserPoolTriggers = {};
                """
                
                for (triggerType, functionName) in triggerFunctionNames {
                    let triggerKey = mapCognitoTriggerType(triggerType)
                    triggersCode += """
                    
                    // Trigger: \(triggerType) -> \(functionName)
                    const \(safeName)\(triggerType.replacingOccurrences(of: "_", with: ""))Fn = lambdaFunctions.get('\(functionName)')
                      || lambda.Function.fromFunctionName(this, '\(safeName)\(triggerType)Lookup', '\(functionName)');
                    \(safeName)Triggers.\(triggerKey) = \(safeName)\(triggerType.replacingOccurrences(of: "_", with: ""))Fn;
                    """
                }
            }
            
            code += triggersCode
            
            code += """
            
                // User Pool: \(pool.poolName)
                const \(safeName)Pool = new cognito.UserPool(this, '\(pool.poolName)', {
                  userPoolName: '\(pool.poolName)',
                  selfSignUpEnabled: true,
                  signInAliases: {
                    email: \(pool.usernameAttributes.contains("email")),
                    phone: \(pool.usernameAttributes.contains("phone_number")),
                    username: \(pool.usernameAttributes.isEmpty || pool.usernameAttributes.contains("username")),
                  },
                  autoVerify: {
                    email: \(pool.autoVerifiedAttributes.contains("email")),
                    phone: \(pool.autoVerifiedAttributes.contains("phone_number")),
                  },
                  mfa: cognito.Mfa.\(mapMfaConfiguration(pool.mfaConfiguration)),
            """
            
            // Add password policy if present
            if let passwordPolicy = pool.passwordPolicy {
                code += """
                
                      passwordPolicy: {
                        minLength: \(passwordPolicy.minimumLength),
                        requireUppercase: \(passwordPolicy.requireUppercase),
                        requireLowercase: \(passwordPolicy.requireLowercase),
                        requireDigits: \(passwordPolicy.requireNumbers),
                        requireSymbols: \(passwordPolicy.requireSymbols),
                      },
                """
            }
            
            // Add triggers if present
            if !triggerFunctionNames.isEmpty {
                code += """
                
                      lambdaTriggers: \(safeName)Triggers,
                """
            }
            
            code += """
                });
                this.userPools.set('\(pool.poolName)', \(safeName)Pool);
            
            """
            
            // Generate app clients
            for client in pool.appClients {
                let clientSafeName = client.clientName.replacingOccurrences(of: "-", with: "")
                code += """
                
                    // App Client: \(client.clientName)
                    const \(clientSafeName)Client = \(safeName)Pool.addClient('\(client.clientName)', {
                      userPoolClientName: '\(client.clientName)',
                      oAuth: {
                        flows: {
                          authorizationCodeGrant: \(client.allowedOAuthFlows.contains("code")),
                          implicitCodeGrant: \(client.allowedOAuthFlows.contains("implicit")),
                        },
                        scopes: [\(client.allowedOAuthScopes.map { "cognito.OAuthScope.\($0.uppercased().replacingOccurrences(of: "/", with: "_"))" }.joined(separator: ", "))],
                        callbackUrls: [\(client.callbackUrls.map { "'\($0)'" }.joined(separator: ", "))],
                        logoutUrls: [\(client.logoutUrls.map { "'\($0)'" }.joined(separator: ", "))],
                      },
                    });
                    this.userPoolClients.set('\(client.clientName)', \(clientSafeName)Client);
                
                """
            }
        }
        
        code += """
          }
        }
        """
        
        return GeneratedFile(
            filename: "extracted-cognito.construct.ts",
            path: "lib/constructs/extracted-cognito.construct.ts",
            content: code,
            resourceType: "Cognito",
            resourceCount: pools.count
        )
    }
    
    private func mapCognitoTriggerType(_ type: String) -> String {
        switch type {
        case "PreSignUp": return "preSignUp"
        case "PostConfirmation": return "postConfirmation"
        case "PreAuthentication": return "preAuthentication"
        case "PostAuthentication": return "postAuthentication"
        case "PreTokenGeneration": return "preTokenGeneration"
        case "CustomMessage": return "customMessage"
        case "DefineAuthChallenge": return "defineAuthChallenge"
        case "CreateAuthChallenge": return "createAuthChallenge"
        case "VerifyAuthChallengeResponse": return "verifyAuthChallengeResponse"
        case "UserMigration": return "userMigration"
        default: return type.prefix(1).lowercased() + type.dropFirst()
        }
    }
    
    private func mapMfaConfiguration(_ config: String) -> String {
        switch config {
        case "ON": return "REQUIRED"
        case "OPTIONAL": return "OPTIONAL"
        case "OFF": return "OFF"
        default: return "OFF"
        }
    }
}

// MARK: - Singleton

extension CDKCodeGenerator {
    static let shared = CDKCodeGenerator()
}

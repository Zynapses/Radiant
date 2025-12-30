import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import * as path from 'path';

interface FormalReasoningStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  apiGateway: apigateway.RestApi;
  lambdaLayer: lambda.LayerVersion;
  dbClusterArn: string;
  dbSecretArn: string;
  databaseName: string;
}

/**
 * Formal Reasoning Stack
 * 
 * Deploys infrastructure for 8 formal reasoning libraries:
 * - Z3 Theorem Prover (constraint solving, theorem proving)
 * - PyArg (structured argumentation)
 * - PyReason (temporal graph reasoning)
 * - RDFLib (SPARQL, semantic web)
 * - OWL-RL (ontological inference)
 * - pySHACL (graph validation)
 * - Logic Tensor Networks (neural-symbolic, SageMaker)
 * - DeepProbLog (probabilistic logic, SageMaker)
 * 
 * Architecture:
 * - Python Lambda Layer for lightweight libs (Z3, PyArg, RDFLib, OWL-RL, pySHACL, PyReason)
 * - SageMaker endpoints for heavy neural-symbolic libs (LTN, DeepProbLog)
 * - Admin API for management and testing
 * - Async queue for long-running reasoning tasks
 */
export class FormalReasoningStack extends cdk.Stack {
  public readonly adminApiLambda: lambda.Function;
  public readonly executorLambda: lambda.Function;
  public readonly pythonLayer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props: FormalReasoningStackProps) {
    super(scope, id, props);

    const { appId, environment, apiGateway, lambdaLayer, dbClusterArn, dbSecretArn, databaseName } = props;

    // =========================================================================
    // Python Lambda Layer for Formal Reasoning Libraries
    // =========================================================================
    // This layer contains: z3-solver, rdflib, owlrl, pyshacl, python-argumentation
    // Built from packages/infrastructure/lambda-layers/formal-reasoning/
    this.pythonLayer = new lambda.LayerVersion(this, 'FormalReasoningPythonLayer', {
      layerVersionName: `${appId}-${environment}-formal-reasoning-python`,
      description: 'Python libraries for formal reasoning: Z3, RDFLib, OWL-RL, pySHACL, PyArg, PyReason',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-layers/formal-reasoning')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      compatibleArchitectures: [lambda.Architecture.X86_64],
    });

    // =========================================================================
    // SQS Queue for Async Reasoning Tasks
    // =========================================================================
    const reasoningQueue = new sqs.Queue(this, 'FormalReasoningQueue', {
      queueName: `${appId}-${environment}-formal-reasoning`,
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'FormalReasoningDLQ', {
          queueName: `${appId}-${environment}-formal-reasoning-dlq`,
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3,
      },
    });

    // =========================================================================
    // Common Lambda Environment
    // =========================================================================
    const commonEnv = {
      NODE_OPTIONS: '--enable-source-maps',
      ENVIRONMENT: environment,
      DB_CLUSTER_ARN: dbClusterArn,
      DB_SECRET_ARN: dbSecretArn,
      DATABASE_NAME: databaseName,
      FORMAL_REASONING_QUEUE_URL: reasoningQueue.queueUrl,
    };

    // =========================================================================
    // Formal Reasoning Executor Lambda (Python)
    // =========================================================================
    // Python Lambda that actually executes Z3, RDFLib, pySHACL, etc.
    this.executorLambda = new lambda.Function(this, 'FormalReasoningExecutor', {
      functionName: `${appId}-${environment}-formal-reasoning-executor`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/formal-reasoning-executor')),
      layers: [this.pythonLayer],
      timeout: cdk.Duration.minutes(5),
      memorySize: 2048, // Z3 needs memory for complex solving
      environment: {
        ENVIRONMENT: environment,
        DB_CLUSTER_ARN: dbClusterArn,
        DB_SECRET_ARN: dbSecretArn,
        DATABASE_NAME: databaseName,
      },
    });

    // Grant DB access
    this.executorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    this.executorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    // Trigger from SQS for async tasks
    this.executorLambda.addEventSource(new lambdaEventSources.SqsEventSource(reasoningQueue, {
      batchSize: 1,
    }));

    // =========================================================================
    // Admin API Lambda (Node.js)
    // =========================================================================
    this.adminApiLambda = new lambda.Function(this, 'FormalReasoningAdmin', {
      functionName: `${appId}-${environment}-formal-reasoning-admin`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'admin/formal-reasoning.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      layers: [lambdaLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ...commonEnv,
        FORMAL_REASONING_EXECUTOR_ARN: this.executorLambda.functionArn,
      },
    });

    // Grant DB access
    this.adminApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [dbClusterArn],
    }));
    this.adminApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [dbSecretArn],
    }));

    // Allow admin to invoke executor synchronously for testing
    this.executorLambda.grantInvoke(this.adminApiLambda);

    // Allow admin to send to queue for async execution
    reasoningQueue.grantSendMessages(this.adminApiLambda);

    // =========================================================================
    // SageMaker Endpoints for Neural-Symbolic Libraries (LTN, DeepProbLog)
    // =========================================================================
    // These are defined but not deployed by default (high cost)
    // Enable via feature flag or manual deployment

    // ECR Repository for custom inference containers
    const inferenceRepo = new ecr.Repository(this, 'NeuralSymbolicRepo', {
      repositoryName: `${appId}-${environment}-neural-symbolic`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
    });

    // SageMaker execution role
    const sagemakerRole = new iam.Role(this, 'SageMakerExecutionRole', {
      roleName: `${appId}-${environment}-formal-reasoning-sagemaker`,
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });

    // Grant ECR access
    inferenceRepo.grantPull(sagemakerRole);

    // LTN Model configuration (not deployed by default)
    const ltnModelConfig = new sagemaker.CfnModel(this, 'LTNModel', {
      modelName: `${appId}-${environment}-ltn`,
      executionRoleArn: sagemakerRole.roleArn,
      primaryContainer: {
        image: `${inferenceRepo.repositoryUri}:ltn-latest`,
        mode: 'SingleModel',
      },
    });
    ltnModelConfig.cfnOptions.condition = new cdk.CfnCondition(this, 'EnableLTN', {
      expression: cdk.Fn.conditionEquals(cdk.Fn.ref('EnableNeuralSymbolic'), 'true'),
    });

    // DeepProbLog Model configuration (not deployed by default)
    const deepproblogModelConfig = new sagemaker.CfnModel(this, 'DeepProbLogModel', {
      modelName: `${appId}-${environment}-deepproblog`,
      executionRoleArn: sagemakerRole.roleArn,
      primaryContainer: {
        image: `${inferenceRepo.repositoryUri}:deepproblog-latest`,
        mode: 'SingleModel',
      },
    });
    deepproblogModelConfig.cfnOptions.condition = new cdk.CfnCondition(this, 'EnableDeepProbLog', {
      expression: cdk.Fn.conditionEquals(cdk.Fn.ref('EnableNeuralSymbolic'), 'true'),
    });

    // Parameter for enabling neural-symbolic endpoints
    new cdk.CfnParameter(this, 'EnableNeuralSymbolic', {
      type: 'String',
      default: 'false',
      allowedValues: ['true', 'false'],
      description: 'Enable SageMaker endpoints for LTN and DeepProbLog (high cost)',
    });

    // =========================================================================
    // API Gateway Routes
    // =========================================================================
    
    // Get or create admin resource
    let adminResource = apiGateway.root.getResource('admin');
    if (!adminResource) {
      adminResource = apiGateway.root.addResource('admin');
    }

    // Formal reasoning admin routes
    const formalReasoningAdmin = adminResource.addResource('formal-reasoning');
    
    // Dashboard & Overview
    formalReasoningAdmin.addResource('dashboard').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Libraries
    const librariesResource = formalReasoningAdmin.addResource('libraries');
    librariesResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    librariesResource.addResource('{libraryId}').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Configuration
    const configResource = formalReasoningAdmin.addResource('config');
    configResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    configResource.addMethod('PUT', new apigateway.LambdaIntegration(this.adminApiLambda));
    configResource.addResource('{library}').addMethod('PUT', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Statistics
    formalReasoningAdmin.addResource('stats').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Invocations
    formalReasoningAdmin.addResource('invocations').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Health
    formalReasoningAdmin.addResource('health').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Costs
    formalReasoningAdmin.addResource('costs').addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Testing endpoints
    const testResource = formalReasoningAdmin.addResource('test');
    testResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    testResource.addResource('z3').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    testResource.addResource('pyarg').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    testResource.addResource('sparql').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    testResource.addResource('shacl').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Knowledge Graph (RDFLib)
    const triplesResource = formalReasoningAdmin.addResource('triples');
    triplesResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    triplesResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    triplesResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Argumentation Frameworks (PyArg)
    const frameworksResource = formalReasoningAdmin.addResource('frameworks');
    frameworksResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    frameworksResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    frameworksResource.addResource('{frameworkId}').addMethod('DELETE', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Temporal Rules (PyReason)
    const rulesResource = formalReasoningAdmin.addResource('rules');
    rulesResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    rulesResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    const ruleIdResource = rulesResource.addResource('{ruleId}');
    ruleIdResource.addMethod('PUT', new apigateway.LambdaIntegration(this.adminApiLambda));
    ruleIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // SHACL Shapes (pySHACL)
    const shapesResource = formalReasoningAdmin.addResource('shapes');
    shapesResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    shapesResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    shapesResource.addResource('{shapeId}').addMethod('DELETE', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Ontologies (OWL-RL)
    const ontologiesResource = formalReasoningAdmin.addResource('ontologies');
    ontologiesResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    ontologiesResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    const ontologyIdResource = ontologiesResource.addResource('{ontologyId}');
    ontologyIdResource.addResource('infer').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Verified Beliefs
    const beliefsResource = formalReasoningAdmin.addResource('beliefs');
    beliefsResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    beliefsResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    const beliefIdResource = beliefsResource.addResource('{beliefId}');
    beliefIdResource.addResource('verify').addMethod('POST', new apigateway.LambdaIntegration(this.adminApiLambda));
    beliefIdResource.addResource('status').addMethod('PUT', new apigateway.LambdaIntegration(this.adminApiLambda));
    
    // Budget Management
    const budgetResource = formalReasoningAdmin.addResource('budget');
    budgetResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminApiLambda));
    budgetResource.addMethod('PUT', new apigateway.LambdaIntegration(this.adminApiLambda));

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'FormalReasoningAdminArn', {
      value: this.adminApiLambda.functionArn,
      description: 'Formal Reasoning Admin Lambda ARN',
    });

    new cdk.CfnOutput(this, 'FormalReasoningExecutorArn', {
      value: this.executorLambda.functionArn,
      description: 'Formal Reasoning Executor Lambda ARN',
    });

    new cdk.CfnOutput(this, 'FormalReasoningQueueUrl', {
      value: reasoningQueue.queueUrl,
      description: 'Formal Reasoning Queue URL',
    });

    new cdk.CfnOutput(this, 'NeuralSymbolicRepoUri', {
      value: inferenceRepo.repositoryUri,
      description: 'ECR Repository for LTN/DeepProbLog containers',
    });
  }
}

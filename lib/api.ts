import {App, SecretValue} from "@aws-cdk/core";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger} from "@aws-cdk/aws-codepipeline-actions";
import {BuildSpec, ComputeType, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {PolicyStatement, Effect} from '@aws-cdk/aws-iam';
import {ApplicationProperties, ApplicationStack} from "./application-stack";
import {ServerApplication} from '@aws-cdk/aws-codedeploy';
import {ApplicationListenerRule} from '@aws-cdk/aws-elasticloadbalancingv2';
import {StageInfrastructure} from "./stage";
import {ARecord, RecordTarget} from "@aws-cdk/aws-route53";
import {LoadBalancerTarget} from "@aws-cdk/aws-route53-targets";

export class Api extends ApplicationStack {
  constructor(scope: App, id: string, props: ApplicationProperties) {
    super(scope, id, props);

    const {
      githubOwner,
      githubRepo,
      githubBranch,
      githubTokenSecretArn,
      githubTokenFieldName,
      stages
    } = this.node.tryGetContext('api');

    const pipeline = new Pipeline(this, `${id}-pipeline`, {
      pipelineName: `${id}-pipeline`
    });

    const sourceOutput = new Artifact();
    const sourceAction = new GitHubSourceAction({
      actionName: 'Source',
      owner: githubOwner,
      repo: githubRepo,
      oauthToken: SecretValue.secretsManager(githubTokenSecretArn, {
        jsonField: githubTokenFieldName
      }),
      output: sourceOutput,
      branch: githubBranch,
      trigger: GitHubTrigger.WEBHOOK
    });
    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    const codebuildProject = new PipelineProject(this, `${id}-codebuild`, {
      buildSpec: BuildSpec.fromSourceFilename('buildspec.yml'),
      environment: {
        computeType: ComputeType.SMALL,
        buildImage: LinuxBuildImage.STANDARD_2_0
      }
    });

    codebuildProject.addToRolePolicy(new PolicyStatement({
      actions: ['ssm:GetParameter'],
      effect: Effect.ALLOW,
      resources: ['*']
    }));

    const buildArtifact = new Artifact();
    const buildAction = new CodeBuildAction({
      actionName: 'Build',
      project: codebuildProject,
      input: sourceOutput,
      outputs: [buildArtifact]
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    const application = new ServerApplication(this, `${id}-codedeploy-application`);

    // Staging
    const stagingStage = new StageInfrastructure(this, `${id}-staging`, {
      vpc: props.vpc,
      application,
      buildArtifact,
      deploymentGroupName: 'staging'
    });

    new ApplicationListenerRule(this, `${id}-staging-application-listener-rule`, {
      listener: props.httpsListener,
      targetGroups: [stagingStage.targetGroup],
      hostHeader: stages.staging.hostName,
      priority: stages.staging.priority,
    });

    new ARecord(this, `${id}-alias-staging-record`, {
      zone: props.zone,
      recordName: stages.staging.hostName,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(props.loadBalancer))
    });

    pipeline.addStage({
      stageName: stages.staging.hostName,
      actions: [stagingStage.deployAction],
    });

    // Production
    const productionStage = new StageInfrastructure(this, `${id}-production`, {
      vpc: props.vpc,
      application,
      buildArtifact,
      deploymentGroupName: 'production'
    });

    new ApplicationListenerRule(this, `${id}-production-application-listener-rule`, {
      listener: props.httpsListener,
      targetGroups: [productionStage.targetGroup],
      hostHeader: stages.production.hostName,
      priority: stages.production.priority,
    });

    new ARecord(this, `${id}-alias-production-record`, {
      zone: props.zone,
      recordName: stages.production.hostName,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(props.loadBalancer))
    });

    pipeline.addStage({
      stageName: stages.production.hostName,
      actions: [productionStage.deployAction],
    });
  }
}
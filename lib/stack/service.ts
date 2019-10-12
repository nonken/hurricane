import {Construct, SecretValue} from "@aws-cdk/core";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger} from "@aws-cdk/aws-codepipeline-actions";
import {BuildSpec, ComputeType, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {PolicyStatement, Effect} from '@aws-cdk/aws-iam';
import {ServerApplication} from '@aws-cdk/aws-codedeploy';
import {Vpc} from '@aws-cdk/aws-ec2';
import {PublicHostedZone} from "@aws-cdk/aws-route53";
import {ApplicationLoadBalancer, ApplicationListener} from '@aws-cdk/aws-elasticloadbalancingv2';

import {StageReturnValue} from "../stage";
import {createStage} from "../stage";

export interface ServiceDefinition {
  vpc: Vpc,
  zone: PublicHostedZone,
  loadBalancer: ApplicationLoadBalancer,
  httpsListener: ApplicationListener,
  configKey: string
}

export class Service extends Construct {
  public readonly stagingStage: StageReturnValue;
  public readonly productionStage: StageReturnValue;

  constructor(scope: Construct, id: string, props: ServiceDefinition) {
    super(scope, id);

    const {
      githubOwner,
      githubRepo,
      githubBranch,
      githubTokenSecretArn,
      githubTokenFieldName,
      stages
    } = this.node.tryGetContext(props.configKey);

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
    this.stagingStage = createStage(this, `${id}-staging`, {
      hostName: stages.staging.hostName,
      priority: stages.staging.priority,
      httpsListener: props.httpsListener,
      loadBalancer: props.loadBalancer,
      vpc: props.vpc,
      zone: props.zone,
      application,
      buildArtifact,
    });

    pipeline.addStage({
      stageName: stages.staging.hostName,
      actions: [this.stagingStage.deployAction],
    });

    // Staging
    this.productionStage = createStage(this, `${id}-production`, {
      hostName: stages.production.hostName,
      priority: stages.production.priority,
      httpsListener: props.httpsListener,
      loadBalancer: props.loadBalancer,
      vpc: props.vpc,
      zone: props.zone,
      application,
      buildArtifact,
    });

    pipeline.addStage({
      stageName: stages.production.hostName,
      actions: [this.productionStage.deployAction],
    });
  }
}
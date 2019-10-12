import {Construct, SecretValue} from "@aws-cdk/core";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger, S3DeployAction} from "@aws-cdk/aws-codepipeline-actions";
import {BuildSpec, ComputeType, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {Effect, PolicyStatement} from '@aws-cdk/aws-iam';
import {Bucket, BucketAccessControl} from '@aws-cdk/aws-s3';
import {CloudFrontWebDistribution, PriceClass} from '@aws-cdk/aws-cloudfront';
import {CloudFrontTarget} from "@aws-cdk/aws-route53-targets";
import {ARecord, PublicHostedZone, RecordTarget} from "@aws-cdk/aws-route53";

export interface StaticDefinition {
  configKey: string,
  zone: PublicHostedZone,
}

export class StaticAssets extends Construct {
  constructor(scope: Construct, id: string, props: StaticDefinition) {
    super(scope, id);

    const {
      githubOwner,
      githubRepo,
      githubBranch,
      githubTokenSecretArn,
      githubTokenFieldName,
      stages
    } = this.node.tryGetContext(props.configKey);
    const certificateArn = this.node.tryGetContext('certificateArn');

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
      buildSpec: BuildSpec.fromSourceFilename('buildspec-static.yml'),
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

    // Staging static assets
    const staticAssetsStaging = new Bucket(this, `${id}-staging-bucket`, {
      accessControl: BucketAccessControl.PUBLIC_READ,
      bucketName: `${id}-staging-bucket`
    });

    const stagingAction = new S3DeployAction({
      actionName: `${id}-s3`,
      input: buildArtifact,
      bucket: staticAssetsStaging
    });

    pipeline.addStage({
      stageName: 'Staging',
      actions: [stagingAction],
    });

    const stagingDistribution = new CloudFrontWebDistribution(this, `${id}-staging-distribution`, {
      originConfigs: [{
        s3OriginSource: {
          s3BucketSource: staticAssetsStaging
        },
        behaviors: [{
          isDefaultBehavior: true,
          compress: true
        }]
      }],
      aliasConfiguration: {
        acmCertRef: certificateArn,
        names: [stages.staging.hostName]
      },
      priceClass: PriceClass.PRICE_CLASS_100
    });

    new ARecord(scope, `${id}-alias-record-staging`, {
      zone: props.zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(stagingDistribution)),
      recordName: stages.staging.hostName
    });

    // Production
    const staticAssetsProduction = new Bucket(this, `${id}-production-bucket`, {
      accessControl: BucketAccessControl.PUBLIC_READ,
      bucketName: `${id}-production-bucket`
    });

    const stagingActionProduction = new S3DeployAction({
      actionName: `${id}-s3`,
      input: buildArtifact,
      bucket: staticAssetsProduction
    });

    pipeline.addStage({
      stageName: stages.production.hostName,
      actions: [stagingActionProduction],
    });

    const productionDistribution = new CloudFrontWebDistribution(this, `${id}-production-distribution`, {
      originConfigs: [{
        s3OriginSource: {
          s3BucketSource: staticAssetsProduction
        },
        behaviors: [{
          isDefaultBehavior: true,
          compress: true
        }]
      }],
      aliasConfiguration: {
        acmCertRef: certificateArn,
        names: [stages.production.hostName]
      },
      priceClass: PriceClass.PRICE_CLASS_100
    });

    new ARecord(scope, `${id}-alias-record-production`, {
      zone: props.zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(productionDistribution)),
      recordName: stages.production.hostName
    });
  }
}
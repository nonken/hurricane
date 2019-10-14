import {ARecord, CnameRecord, RecordTarget} from "@aws-cdk/aws-route53";
import {PolicyStatement, Effect} from '@aws-cdk/aws-iam';
import {Construct, SecretValue} from "@aws-cdk/core";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger, S3DeployAction} from "@aws-cdk/aws-codepipeline-actions";
import {BuildSpec, ComputeType, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {ServerApplication} from '@aws-cdk/aws-codedeploy';
import {Vpc} from '@aws-cdk/aws-ec2';
import {PublicHostedZone} from "@aws-cdk/aws-route53";
import {ApplicationLoadBalancer, ApplicationListener} from '@aws-cdk/aws-elasticloadbalancingv2';
import {Bucket, BucketAccessControl} from '@aws-cdk/aws-s3';

import {StageInfrastructure} from "../stage";
import {CloudFrontWebDistribution, PriceClass} from "@aws-cdk/aws-cloudfront";
import {CloudFrontTarget} from "@aws-cdk/aws-route53-targets";

export interface ServiceDefinition {
  vpc: Vpc,
  zone: PublicHostedZone,
  loadBalancer: ApplicationLoadBalancer,
  httpsListener: ApplicationListener,
  configKey: string
}

export class WebService extends Construct {
  constructor(scope: Construct, id: string, props: ServiceDefinition) {
    super(scope, id);

    const certificateArn = this.node.tryGetContext('certificateArn');
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

    const buildArtifact = new Artifact('service');
    const staticArtifact = new Artifact('static');
    const buildAction = new CodeBuildAction({
      actionName: 'Build',
      project: codebuildProject,
      input: sourceOutput,
      outputs: [
        buildArtifact,
        staticArtifact
      ]
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    const application = new ServerApplication(this, `${id}-codedeploy-application`);

    // Staging
    const stagingStage = new StageInfrastructure(this, `${id}-staging`, {
      hostName: stages.staging.hostName,
      priority: stages.staging.priority,
      httpsListener: props.httpsListener,
      loadBalancer: props.loadBalancer,
      vpc: props.vpc,
      zone: props.zone,
      application,
      buildArtifact,
      deploymentGroupName: 'staging'
    });

    // Staging static assets
    const staticAssetsStaging = new Bucket(this, `${id}-staging-bucket`, {
      accessControl: BucketAccessControl.PUBLIC_READ,
      bucketName: `${id}-staging-bucket`,
      publicReadAccess: true
    });

    const stagingStaticDeployAction = new S3DeployAction({
      actionName: `${id}-s3`,
      input: staticArtifact,
      bucket: staticAssetsStaging
    });

    pipeline.addStage({
      stageName: stages.staging.hostName,
      actions: [stagingStaticDeployAction, stagingStage.deployAction],
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
        names: [stages.staging.staticAssetsHostName]
      },
      priceClass: PriceClass.PRICE_CLASS_100
    });

    new ARecord(scope, `${id}-alias-record-staging`, {
      zone: props.zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(stagingDistribution)),
      recordName: stages.staging.staticAssetsHostName
    });

    // Production
    const productionStage = new StageInfrastructure(this, `${id}-production`, {
      hostName: stages.production.hostName,
      priority: stages.production.priority,
      httpsListener: props.httpsListener,
      loadBalancer: props.loadBalancer,
      vpc: props.vpc,
      zone: props.zone,
      application,
      buildArtifact,
      deploymentGroupName: 'production'
    });

    const staticAssetsProduction = new Bucket(this, `${id}-production-bucket`, {
      accessControl: BucketAccessControl.PUBLIC_READ,
      bucketName: `${id}-production-bucket`,
      publicReadAccess: true
    });

    const productionActionProduction = new S3DeployAction({
      actionName: `${id}-s3`,
      input: staticArtifact,
      bucket: staticAssetsProduction
    });

    pipeline.addStage({
      stageName: stages.production.hostName,
      actions: [productionActionProduction, productionStage.deployAction],
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
        names: [stages.production.staticAssetsHostName]
      },
      priceClass: PriceClass.PRICE_CLASS_100
    });

    new ARecord(scope, `${id}-alias-record-production`, {
      zone: props.zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(productionDistribution)),
      recordName: stages.production.staticAssetsHostName
    });

    // Add CNAME entry to have www. behave like the root.
    const stage = stages.production;
    if (stage.cname) {
      // www to root cname and loadbalancer matching
      new CnameRecord(this, `${id}-cname-www-to-root`, {
        domainName: stage.hostName,
        recordName: stage.cname.recordName,
        zone: props.zone
      });

      props.httpsListener.addTargetGroups(`${id}-target-group`, {
        targetGroups: [productionStage.targetGroup],
        hostHeader: `${stage.cname.recordName}.${stage.hostName}`,
        priority: stage.cname.priority
      });
    }
  }
}
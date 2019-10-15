import {ARecord, CnameRecord, RecordTarget} from "@aws-cdk/aws-route53";
import {PolicyStatement, Effect} from '@aws-cdk/aws-iam';
import {SecretValue, App} from "@aws-cdk/core";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger, S3DeployAction} from "@aws-cdk/aws-codepipeline-actions";
import {BuildSpec, ComputeType, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {ServerApplication} from '@aws-cdk/aws-codedeploy';
import {Bucket, BucketAccessControl} from '@aws-cdk/aws-s3';
import {ApplicationListenerRule} from '@aws-cdk/aws-elasticloadbalancingv2';

import {StageInfrastructure} from "./stage";
import {CloudFrontWebDistribution, PriceClass} from "@aws-cdk/aws-cloudfront";
import {CloudFrontTarget, LoadBalancerTarget} from "@aws-cdk/aws-route53-targets";
import {ApplicationProperties, ApplicationStack} from "./application-stack";


export class Web extends ApplicationStack {
  constructor(scope: App, id: string, props: ApplicationProperties) {
    super(scope, id, props);

    const {
      githubOwner,
      githubRepo,
      githubBranch,
      githubTokenSecretArn,
      githubTokenFieldName,
      stages
    } = this.node.tryGetContext('web');
    const certificateArn = props.certificate.certificateArn;

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

    // Staging static assets
    const staticAssetsStaging = new Bucket(this, `${id}-staging-assets`, {
      accessControl: BucketAccessControl.PUBLIC_READ,
      bucketName: `${id}-staging-static-assets`,
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

    new ARecord(this, `${id}-alias-record-staging`, {
      zone: props.zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(stagingDistribution)),
      recordName: stages.staging.staticAssetsHostName
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

    const staticAssetsProduction = new Bucket(this, `${id}-production-assets`, {
      accessControl: BucketAccessControl.PUBLIC_READ,
      bucketName: `${id}-production-static-assets`,
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

    new ARecord(this, `${id}-alias-record-production`, {
      zone: props.zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(productionDistribution)),
      recordName: stages.production.staticAssetsHostName
    });

    // www to root cname and loadbalancer matching
    new CnameRecord(this, `${id}-cname-www-to-root`, {
      domainName: stages.production.hostName,
      recordName: stages.production.cname.recordName,
      zone: props.zone
    });

    new ApplicationListenerRule(this, `${id}-production-www-application-listener-rule`, {
      listener: props.httpsListener,
      targetGroups: [productionStage.targetGroup],
      hostHeader: `${stages.production.cname.recordName}.${stages.production.hostName}`,
      priority: stages.production.cname.priority
    });
  }
}
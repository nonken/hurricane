import {Stack, StackProps, App, SecretValue} from '@aws-cdk/core';
import {PipelineProject, BuildSpec, LinuxBuildImage} from '@aws-cdk/aws-codebuild';
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction, GitHubTrigger} from '@aws-cdk/aws-codepipeline-actions';
import {ServerApplication} from '@aws-cdk/aws-codedeploy';
import {PolicyStatement, Effect} from '@aws-cdk/aws-iam';
import {ComputeType} from "@aws-cdk/aws-codebuild";
import {PublicHostedZone, CnameRecord} from "@aws-cdk/aws-route53";
import {Vpc} from '@aws-cdk/aws-ec2';
import {createStage} from "./stage";
import {createLoadBalancer} from "./load-balancer";

interface CName {
  recordName: string,
  priority: number
}

interface Stage {
  hostName: string,
  stageName: string,
  priority: number,
  cname?: CName
}

export class Main extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const githubOwner = this.node.tryGetContext('githubOwner');
    const githubRepo = this.node.tryGetContext('githubRepo');
    const githubBranch = this.node.tryGetContext('githubBranch');
    const githubTokenSecretArn = this.node.tryGetContext('githubTokenSecretArn');
    const githubTokenFieldName = this.node.tryGetContext('githubTokenFieldName');
    const certificateArns = this.node.tryGetContext('certificateArns');
    const stages = this.node.tryGetContext('stages');
    const zoneName = this.node.tryGetContext('zoneName');

    const vpc = new Vpc(this, `${id}-vpc`);

    const pipeline = new Pipeline(this, `${id}-pipeline`, {
      pipelineName: `${id}-pipeline`
    });

    const zone = new PublicHostedZone(this, `${id}-hosted-zone`, {
      zoneName
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

    const {loadBalancer, httpsListener} = createLoadBalancer(this, `${id}`, {
      vpc,
      certificateArns: certificateArns
    });

    for(const stageKey in stages) {
      const {stage, deployAction} = createStage(this, `${id}-${stageKey}`, {
        hostName: stages[stageKey].hostName,
        priority: stages[stageKey].priority,
        application,
        httpsListener,
        vpc,
        zone,
        loadBalancer,
        buildArtifact,
      });

      pipeline.addStage({
        stageName: stages[stageKey].hostName,
        actions: [deployAction],
      });

      const cname = stages[stageKey].cname;
      if (cname) {
        // www to root cname and loadbalancer matching
        new CnameRecord(this, `${id}-cname-www-to-root`, {
          domainName: stages[stageKey].hostName,
          recordName: cname.recordName,
          zone
        });

        httpsListener.addTargetGroups(`${id}-target-group`, {
          targetGroups: [stage.targetGroup],
          hostHeader: `${cname.recordName}.${stages[stageKey].hostName}`,
          priority: cname.priority
        });
      }
    }
  }
}


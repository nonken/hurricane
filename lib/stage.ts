import {Construct, Duration} from '@aws-cdk/core';
import {ApplicationTargetGroup, ApplicationProtocol} from "@aws-cdk/aws-elasticloadbalancingv2";
import {Vpc, UserData, InstanceType, InstanceClass, InstanceSize, AmazonLinuxImage, SubnetType} from '@aws-cdk/aws-ec2';
import {AutoScalingGroup} from '@aws-cdk/aws-autoscaling';
import {Artifact} from "@aws-cdk/aws-codepipeline";
import {ServerApplication, LoadBalancer, ServerDeploymentGroup, ServerDeploymentConfig} from '@aws-cdk/aws-codedeploy';
import {CodeDeployServerDeployAction} from '@aws-cdk/aws-codepipeline-actions';
import {Role, ServicePrincipal, ManagedPolicy, PolicyStatement, Effect} from '@aws-cdk/aws-iam';

export interface StageInfrastructureDefinition {
  application: ServerApplication,
  vpc: Vpc,
  buildArtifact: Artifact,
  deploymentGroupName: string
}

export class StageInfrastructure extends Construct {
  public readonly deployAction: CodeDeployServerDeployAction;
  public readonly targetGroup: ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: StageInfrastructureDefinition) {
    super(scope, id);

    const userData = UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'curl --silent --location https://rpm.nodesource.com/setup_12.x | bash -',
      'yum -y update',
      'yum install -y nodejs',
      'npm install -g pm2',
      'mkdir -p /home/ec2-user/app/keys',
      'cd /home/ec2-user/app/keys',
      'openssl req -new -newkey rsa:4096 -days 365 -nodes -x509 -subj "/C=/ST=/L=/O=/CN=localhost" -keyout key.pem -out cert.pem',
      'mkdir -p /home/ec2-user/app/logs',
      'chown -R ec2-user:ec2-user /home/ec2-user/app'
    );

    const role = new Role(this, `${id}-instance-role`, {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite')
      ]
    });

    const asg = new AutoScalingGroup(this, `${id}-asg`, {
      vpc: props.vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: new AmazonLinuxImage(),
      minCapacity: 1,
      maxCapacity: 1,
      associatePublicIpAddress: true,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
      role,
      userData
    });

    this.targetGroup = new ApplicationTargetGroup(this, `${id}-lb-fleet`, {
      port: 8443,
      protocol: ApplicationProtocol.HTTPS,
      targets: [asg],
      deregistrationDelay: Duration.seconds(60),
      vpc: props.vpc,
      healthCheck: {
        path: '/_health',
        port: '8443',
        timeout: Duration.seconds(2),
        interval: Duration.seconds(5),
        unhealthyThresholdCount: 2,
        healthyThresholdCount: 2
      }
    });

    const deploymentGroup = new ServerDeploymentGroup(this, `${id}-deployment-group`, {
      autoScalingGroups: [asg],
      installAgent: true,
      application: props.application,
      loadBalancer: LoadBalancer.application(this.targetGroup),
      deploymentConfig: ServerDeploymentConfig.ALL_AT_ONCE,
      deploymentGroupName: props.deploymentGroupName
    });

    this.deployAction = new CodeDeployServerDeployAction({
      actionName: `${id}-codedeploy`,
      input: props.buildArtifact,
      deploymentGroup: deploymentGroup
    });
  }
}
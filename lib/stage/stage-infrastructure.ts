import {Construct, Duration} from '@aws-cdk/core';
import {AutoScalingGroup} from '@aws-cdk/aws-autoscaling';
import {Vpc, UserData, InstanceType, InstanceClass, InstanceSize, AmazonLinuxImage} from '@aws-cdk/aws-ec2';
import codedeploy = require('@aws-cdk/aws-codedeploy');
import {ApplicationProtocol, ApplicationTargetGroup} from '@aws-cdk/aws-elasticloadbalancingv2';
import {SubnetType} from '@aws-cdk/aws-ec2';

export interface StageInfrastructureDefinition {
  application: codedeploy.ServerApplication,
  vpc: Vpc
}

export class StageInfrastructure extends Construct {
  public readonly deploymentGroup: codedeploy.ServerDeploymentGroup;
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

      'chown -R ec2-user:ec2-user /home/ec2-user/app',

      '/opt/aws/bin/cfn-init -v --stack ${AWS::StackName} --region ${AWS::Region} --resource Instance',
      '/opt/aws/bin/cfn-signal -e 0 --stack ${AWS::StackName} --region ${AWS::Region} --resource Instance'
    );

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

    this.deploymentGroup = new codedeploy.ServerDeploymentGroup(this, `${id}-deployment-group`, {
      autoScalingGroups: [asg],
      installAgent: true,
      application: props.application,
      loadBalancer: codedeploy.LoadBalancer.application(this.targetGroup),
      deploymentConfig: codedeploy.ServerDeploymentConfig.ALL_AT_ONCE
    });
  }
}
import {App, Stack, StackProps} from '@aws-cdk/core';
import {PublicHostedZone} from "@aws-cdk/aws-route53";
import {Vpc} from '@aws-cdk/aws-ec2';
import {WebService} from "./stack/web";
import {ApiService} from "./stack/api";
import {createLoadBalancer} from "./load-balancer";

export class Region extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const stackName = this.node.tryGetContext('stackName');
    const zoneName = this.node.tryGetContext('zoneName');
    const certificateArns = this.node.tryGetContext('certificateArns');

    const vpc = new Vpc(this, `${stackName}-vpc`);

    const zone = new PublicHostedZone(this, `${stackName}-hosted-zone`, {
      zoneName
    });

    const {loadBalancer, httpsListener} = createLoadBalancer(this, `${id}`, {
      vpc: vpc,
      certificateArns: certificateArns
    });

    new WebService(this, `${stackName}-web-service`, {
      zone,
      vpc,
      loadBalancer,
      httpsListener,
      configKey: 'webService'
    });

    new ApiService(this, `${stackName}-api-service`, {
      zone,
      vpc,
      loadBalancer,
      httpsListener,
      configKey: 'apiService'
    });
  }
}


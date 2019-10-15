import {App, Stack, StackProps} from '@aws-cdk/core';
import {Vpc} from '@aws-cdk/aws-ec2';

import {WebService} from "./stack/web";
import {ApiService} from "./stack/api";
import {createLoadBalancer} from "./load-balancer";
import {Dns} from "./dns";

export class Region extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const stackName = this.node.tryGetContext('stackName');
    const zoneName = this.node.tryGetContext('zoneName');
    const certificateArn = this.node.tryGetContext('certificateArn');

    const vpc = new Vpc(this, `${stackName}-vpc`);
    const dns = new Dns(this, `${stackName}-dns`);

    const {loadBalancer, httpsListener} = createLoadBalancer(this, `${id}`, {
      vpc: vpc,
      certificateArns: [certificateArn]
    });

    new WebService(this, `${stackName}-web-service`, {
      zone: dns.zone,
      vpc,
      loadBalancer,
      httpsListener
    });

    new ApiService(this, `${stackName}-api-service`, {
      zone: dns.zone,
      vpc,
      loadBalancer,
      httpsListener
    });
  }
}


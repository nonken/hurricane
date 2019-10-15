import {App, Stack, StackProps} from '@aws-cdk/core';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationListener,
  CfnListener
} from '@aws-cdk/aws-elasticloadbalancingv2';
import {Vpc} from '@aws-cdk/aws-ec2';
import {DnsValidatedCertificate} from '@aws-cdk/aws-certificatemanager';

interface SharedStackProperties extends StackProps {
  certificate: DnsValidatedCertificate
}

export class Shared extends Stack {
  public readonly loadBalancer: ApplicationLoadBalancer;
  public readonly httpsListener: ApplicationListener;
  public readonly vpc: Vpc;

  constructor(scope: App, id: string, props: SharedStackProperties) {
    super(scope, id, props);

    const stackName = this.node.tryGetContext('stackName');
    const certificateArn = props.certificate.certificateArn;

    this.vpc = new Vpc(this, `${stackName}-vpc`);

    this.loadBalancer = new ApplicationLoadBalancer(this, `${id}-loadbalancer`, {
      vpc: this.vpc,
      internetFacing: true,
    });

    this.httpsListener = this.loadBalancer.addListener(`${id}-https-listener`, {
      port: 443,
      open: true,
      certificateArns: [certificateArn],
      protocol: ApplicationProtocol.HTTPS
    });

    this.httpsListener.addFixedResponse(`${id}-default-https-response`, {
      statusCode: "404"
    });

    this.httpsListener.connections.allowDefaultPortFromAnyIpv4('Open to the world');

    const httpListener = this.loadBalancer.addListener(`${id}-http-listener`, {
      protocol: ApplicationProtocol.HTTP
    });

    httpListener.addFixedResponse(`${id}-default-http-response`, {
      statusCode: "404"
    });

    const cfnHttpListener = httpListener.node.defaultChild as CfnListener;
    cfnHttpListener.defaultActions = [{
      type: "redirect",
      redirectConfig: {
        protocol: "HTTPS",
        host: "#{host}",
        path: "/#{path}",
        query: "#{query}",
        port: "443",
        statusCode: "HTTP_301"
      }
    }];
  }
}


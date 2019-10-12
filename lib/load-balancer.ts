import {Construct} from "@aws-cdk/core";
import {Vpc} from '@aws-cdk/aws-ec2';
import {ApplicationLoadBalancer, ApplicationProtocol, CfnListener} from '@aws-cdk/aws-elasticloadbalancingv2';

export interface LoadBalancerDefinition {
  vpc: Vpc,
  certificateArns: string[]
}

export function createLoadBalancer(scope: Construct, id: string, props: LoadBalancerDefinition) {
  const loadBalancer = new ApplicationLoadBalancer(scope, `${id}-loadbalancer`, {
    vpc: props.vpc,
    internetFacing: true,
  });

  const httpsListener = loadBalancer.addListener(`${id}-https-listener`, {
    port: 443,
    open: true,
    certificateArns: props.certificateArns,
    protocol: ApplicationProtocol.HTTPS
  });

  httpsListener.addFixedResponse(`${id}-default-https-response`, {
    statusCode: "404"
  });

  httpsListener.connections.allowDefaultPortFromAnyIpv4('Open to the world');

  const httpListener = loadBalancer.addListener(`${id}-http-listener`, {
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

  return {loadBalancer, httpsListener};
}


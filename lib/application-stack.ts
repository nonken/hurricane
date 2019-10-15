import {App, Stack, StackProps} from "@aws-cdk/core";
import {Vpc} from '@aws-cdk/aws-ec2';
import {PublicHostedZone} from "@aws-cdk/aws-route53";
import {ApplicationLoadBalancer, ApplicationListener} from "@aws-cdk/aws-elasticloadbalancingv2";
import {DnsValidatedCertificate} from '@aws-cdk/aws-certificatemanager';

export interface ApplicationProperties extends StackProps {
  vpc: Vpc,
  zone: PublicHostedZone,
  certificate: DnsValidatedCertificate
  loadBalancer: ApplicationLoadBalancer,
  httpsListener: ApplicationListener
}

export class ApplicationStack extends Stack {
  constructor(scope: App, id: string, props: ApplicationProperties) {
    super(scope, id, props);
  }
}
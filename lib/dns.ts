import {Stack, StackProps, App} from '@aws-cdk/core';
import {PublicHostedZone, MxRecord} from "@aws-cdk/aws-route53";
import {DnsValidatedCertificate} from '@aws-cdk/aws-certificatemanager';

export class Dns extends Stack {
  public readonly zone: PublicHostedZone;
  public readonly certificate: DnsValidatedCertificate

  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const stackName = this.node.tryGetContext('stackName');
    const zoneName = this.node.tryGetContext('zoneName');
    const mxRecords = this.node.tryGetContext('mxRecords');
    const certificateDomainName = this.node.tryGetContext('certificateDomainName');
    const certificateAlternativeDomainName = this.node.tryGetContext('certificateAlternativeDomainName');

    this.zone = new PublicHostedZone(this, `${stackName}-hosted-zone`, {
      zoneName
    });

    this.certificate = new DnsValidatedCertificate(this, `${stackName}-certificate`, {
      domainName: certificateDomainName,
      subjectAlternativeNames: [certificateAlternativeDomainName],
      hostedZone: this.zone,
    });

    if (mxRecords !== null) {
      new MxRecord(this, `${stackName}-mx-records`, {
        zone: this.zone,
        values: mxRecords
      })
    }
  }
}


import {Construct} from '@aws-cdk/core';
import {PublicHostedZone, MxRecord} from "@aws-cdk/aws-route53";

export class Dns extends Construct {
  public readonly zone: PublicHostedZone;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const stackName = this.node.tryGetContext('stackName');
    const zoneName = this.node.tryGetContext('zoneName');
    const mxRecords = this.node.tryGetContext('mxRecords');

    this.zone = new PublicHostedZone(this, `${stackName}-hosted-zone`, {
      zoneName
    });

    if (mxRecords !== null) {
      new MxRecord(this, `${stackName}-mx-records`, {
        zone: this.zone,
        values: mxRecords
      })
    }
  }
}


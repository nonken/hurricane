import {CnameRecord} from "@aws-cdk/aws-route53";
import {Service} from "./service";
import {Construct} from "@aws-cdk/core";
import {ServiceDefinition} from "./service";

export class WebService extends Service {
  constructor(scope: Construct, id: string, props: ServiceDefinition) {
    super(scope, id, props);

    const {stages} = this.node.tryGetContext(props.configKey);

    // Add CNAME entry to have www. behave like the root.
    const stage = stages.production;
    if (stage.cname) {
      // www to root cname and loadbalancer matching
      new CnameRecord(this, `${id}-cname-www-to-root`, {
        domainName: stage.hostName,
        recordName: stage.cname.recordName,
        zone: props.zone
      });

      props.httpsListener.addTargetGroups(`${id}-target-group`, {
        targetGroups: [this.productionStage.targetGroup],
        hostHeader: `${stage.cname.recordName}.${stage.hostName}`,
        priority: stage.cname.priority
      });
    }
  }
}
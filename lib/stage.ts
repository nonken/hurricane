import {Construct} from '@aws-cdk/core';
import {ApplicationListener, ApplicationLoadBalancer} from "@aws-cdk/aws-elasticloadbalancingv2";
import {Vpc} from "@aws-cdk/aws-ec2";
import {ARecord, PublicHostedZone, RecordTarget} from "@aws-cdk/aws-route53";
import {Artifact} from "@aws-cdk/aws-codepipeline";
import {StageInfrastructure} from "./stage-infrastructure";
import {LoadBalancerTarget} from "@aws-cdk/aws-route53-targets";
import {ServerApplication} from '@aws-cdk/aws-codedeploy';
import {CodeDeployServerDeployAction} from '@aws-cdk/aws-codepipeline-actions';

export interface StageDefinition {
    application: ServerApplication,
    httpsListener: ApplicationListener
    vpc: Vpc,
    zone: PublicHostedZone,
    loadBalancer: ApplicationLoadBalancer,
    buildArtifact: Artifact,
    hostName: string,
    priority: number
}

export function createStage(scope: Construct, id: string, props: StageDefinition) {
    const stage = new StageInfrastructure(scope, `${id}-stage`, {
        application: props.application,
        vpc: props.vpc
    });

    props.httpsListener.addTargetGroups(`${id}-target-group`, {
        targetGroups: [stage.targetGroup],
        hostHeader: props.hostName,
        priority: props.priority
    });

    new ARecord(scope, `${id}-alias-record`, {
        zone: props.zone,
        recordName: props.hostName,
        target: RecordTarget.fromAlias(new LoadBalancerTarget(props.loadBalancer))
    });

    const deployAction = new CodeDeployServerDeployAction({
        actionName: `${id}-codedeploy`,
        input: props.buildArtifact,
        deploymentGroup: stage.deploymentGroup
    });

    return {
        stage,
        deployAction
    }
}
import {Service} from "./service";
import {Construct} from "@aws-cdk/core";
import {ServiceDefinition} from "./service";

export class ApiService extends Service {
    constructor(scope: Construct, id: string, props: ServiceDefinition) {
        super(scope, id, props);
    }
}
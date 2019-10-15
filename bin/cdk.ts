#!/usr/bin/env node

import cdk = require('@aws-cdk/core');
import {Dns} from "../lib/dns";
import {Shared} from "../lib/shared";
import {Web} from "../lib/web";
import {Api} from "../lib/api";

const app = new cdk.App({});

const ENV = {
  region: 'us-east-1'
};

const dns = new Dns(app, 'dns', {
  env: ENV
});

const shared = new Shared(app, 'shared', {
  env: ENV,
  certificate: dns.certificate
});

const web = new Web(app, 'web', {
  vpc: shared.vpc,
  zone: dns.zone,
  certificate: dns.certificate,
  loadBalancer: shared.loadBalancer,
  httpsListener: shared.httpsListener,
  env: ENV
});

new Api(app, 'api', {
  vpc: shared.vpc,
  zone: dns.zone,
  certificate: dns.certificate,
  loadBalancer: shared.loadBalancer,
  httpsListener: shared.httpsListener,
  env: ENV
});

app.synth();

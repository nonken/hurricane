#!/usr/bin/env node
import cdk = require('@aws-cdk/core');
import {Region} from '../lib/region';

const app = new cdk.App({});

new Region(app, 'stack', {
  env: {
    region: 'us-east-1'
  }
});

app.synth();

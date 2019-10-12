#!/usr/bin/env node
import cdk = require('@aws-cdk/core');
import { Main } from '../lib/main';

const app = new cdk.App({});

new Main(app, 'stack', {
    env: {
        region: 'us-east-1'
    }
});

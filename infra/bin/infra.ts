#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CalculatorSiteStack } from '../lib/calculator-site-stack';

const app = new cdk.App();

// Optional custom domain, supplied at deploy time:
//   cdk deploy -c domainName=calc.example.com -c hostedZoneId=Z123EXAMPLE
// With neither, the site is served from the default *.cloudfront.net URL.
const domainName = app.node.tryGetContext('domainName') as string | undefined;
const hostedZoneId = app.node.tryGetContext('hostedZoneId') as string | undefined;

if (Boolean(domainName) !== Boolean(hostedZoneId)) {
  throw new Error(
    'domainName and hostedZoneId must be supplied together: ' +
      'cdk deploy -c domainName=calc.example.com -c hostedZoneId=Z123EXAMPLE',
  );
}

new CalculatorSiteStack(app, 'CalculatorSiteStack', {
  domainName,
  hostedZoneId,
  // CloudFront certificates must live in us-east-1, so the whole stack does.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  description: 'Static calculator site: S3 (private) behind CloudFront',
});

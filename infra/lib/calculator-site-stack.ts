import * as path from 'node:path';
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

export interface CalculatorSiteStackProps extends StackProps {
  /**
   * Custom domain for the site, e.g. `calc.example.com`. Omit both this and
   * `hostedZoneId` to serve from the default `*.cloudfront.net` URL.
   */
  readonly domainName?: string;
  /** Route 53 public hosted zone that owns `domainName`. */
  readonly hostedZoneId?: string;
}

/** Built web assets, produced by `npm run build` at the repo root. */
const SITE_ASSETS = path.join(__dirname, '..', '..', 'web', 'dist');

export class CalculatorSiteStack extends Stack {
  constructor(scope: Construct, id: string, props: CalculatorSiteStackProps = {}) {
    super(scope, id, props);

    const { domainName, hostedZoneId } = props;
    const useCustomDomain = Boolean(domainName && hostedZoneId);

    // Private bucket: CloudFront reads it through Origin Access Control, and
    // nothing else can. It is not configured as a website endpoint.
    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Only created when a domain was supplied. The stack lives in us-east-1,
    // which is where CloudFront requires its certificate to be.
    let zone: route53.IHostedZone | undefined;
    let certificate: acm.ICertificate | undefined;

    if (useCustomDomain) {
      zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: hostedZoneId!,
        zoneName: domainName!.split('.').slice(-2).join('.'),
      });
      certificate = new acm.Certificate(this, 'SiteCertificate', {
        domainName: domainName!,
        validation: acm.CertificateValidation.fromDns(zone),
      });
    }

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'Calculator static site',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // Single-page app: unknown paths fall back to the entry document rather
      // than leaking S3's 403/404.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
      ...(useCustomDomain ? { domainNames: [domainName!], certificate } : {}),
    });

    // Uploads web/dist and invalidates the edge cache on every deploy, so the
    // stack fails fast if the site was not built first.
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(SITE_ASSETS)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    if (useCustomDomain) {
      new route53.ARecord(this, 'SiteAliasRecord', {
        zone: zone!,
        recordName: domainName!,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution),
        ),
      });
    }

    new CfnOutput(this, 'SiteUrl', {
      value: useCustomDomain
        ? `https://${domainName}`
        : `https://${distribution.distributionDomainName}`,
      description: 'Public URL of the calculator',
    });
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain name (always available)',
    });
    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution id, for manual invalidations',
    });
    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket holding the built site',
    });
  }
}

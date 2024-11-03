import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class NekoFoundationSite extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // CloudFront Origin Access Identity
        const nekoSiteOriginAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'NekoSiteOriginAccessIdentity', {});

        // S3 Bucket: nekofoundation.org
        const nekoSiteBucket = new s3.Bucket(this, 'NekoSiteBucket', {
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            bucketName: 'nekofoundation.org',
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        nekoSiteBucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [nekoSiteBucket.arnForObjects('*')],
            principals: [new iam.CanonicalUserPrincipal(nekoSiteOriginAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
        }));

        new cdk.CfnOutput(this, 'NekoSiteBucketName', { value: nekoSiteBucket.bucketName });

        // Certificate: nekofoundation.org
        const nekoSiteCertificate = new acm.Certificate(this, 'NekoSiteCertificate', {
            domainName: 'nekofoundation.org',
            subjectAlternativeNames: ['www.nekofoundation.org'],
            validation: acm.CertificateValidation.fromEmail({
                ['nekofoundation.org']: 'nekofoundation.org',
                ['www.nekofoundation.org']: 'nekofoundation.org'
            })
        });

        new cdk.CfnOutput(this, 'NekoSiteCertificateArn', { value: nekoSiteCertificate.certificateArn });

        // CloudFront Distribution: nekofoundation.org
        const distribution = new cloudfront.Distribution(this, 'NekoSiteDistribution', {
            defaultBehavior: {
                origin: new cloudfront_origins.S3Origin(nekoSiteBucket, { originAccessIdentity: nekoSiteOriginAccessIdentity }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            },
            certificate: nekoSiteCertificate,
            defaultRootObject: 'index.html',
            domainNames: ['nekofoundation.org', 'www.nekofoundation.org'],
            errorResponses: [{
                httpStatus: 403,
                responseHttpStatus: 404,
                responsePagePath: '/index.html'
            }],
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100
        });

        new cdk.CfnOutput(this, 'NekoSiteDistributionId', { value: distribution.distributionId });
        new cdk.CfnOutput(this, 'NekoSiteDistributionDomainName', { value: distribution.distributionDomainName });

        new s3deploy.BucketDeployment(this, 'NekoSiteBucketDeployment', {
            destinationBucket: nekoSiteBucket,
            sources: [s3deploy.Source.asset('./site-contents')],
            distribution,
            distributionPaths: ['/*']
        });
    }
}

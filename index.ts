import * as cdk from 'aws-cdk-lib';
import { NekoFoundationSite } from './site';

const app = new cdk.App();
new NekoFoundationSite(app, 'NekoFoundationSiteStack', {});

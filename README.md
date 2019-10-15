# Hurricane

> Setup a complete bootstrapped service architecture on AWS in just a few minutes.

Hurricane helps you to setup a complete service architecture on AWS using the AWS CDK.
The purpose of Hurricane is to help you learn about the CDK. It is trying to incorporate best practices where helpful. 
Hurricane currently doesn't provision a serverless stack. This will be part of a future iteration.
 
## Hurricane provisions four CDK stacks. 

**DNS** A Route53 zone with a certificate so that you can serve traffic over SSL.

**Shared** Shared components such a load-balancer and the VPC.

**Web** A CI/CD pipeline for a webservice and static assets served via a CloudFront distribution. The pipeline includes a staging and a production environment. Traffic is served via SSL (https://) and traffic going over HTTP is redirected to HTTPS. 

**Api** A CI/CD pipeline for an api service (controlplane). The pipeline includes a staging and a production environment. Traffic is served via SSL (https://) and traffic going over HTTP is redirected to HTTPS. 

## Usage
Follow the below prerequisites to spin up a new stack.

### 1. Buy a domain where you can manage DNS

### 2. Create a GitHub API token
1. Go to [GitHub](https://github.com/settings/tokens) and create an API key. The key needs to include all `repo` and all `admin:repo_hook` permissions. 
2. Store key in AWS Secret Manager. Name the key as you like and paste the GitHub key as a value.

### 3. Setup `cdk.context.json`
Copy `cdk.context.template.json` to `cdk.context.json` and fill in the correct values.

### 4. Setup the application repos
You can deploy any application which includes an `appspec.yml` (CodeDeploy) and a `buildspec.yml` (CodeBuild) in the root of the repository.
`TODO: provide sample applications.`

### 5. During the DNS cdk deployment, update your registrar records
Once the Route53 zone has been created, head to the console to get the nameserver entries.
Update those at your registrar so that your domain points to the correct Route53 nameserver. 
It'll take a few seconds until your certificate gets provisioned.

### 6. Deploy the stack
```
cdk deploy --profile YOUR_CREDENTIAL_PROFILE dns shared web api
```

### 7. Profit 🎉

**Web**
Prod: https://your.domain
Staging: https://staging.your.domain

**Static assets**
Prod: https://static.your.domain
Staging: https://static-staging.your.domain

**Api**
Prod: https://api.your.domain
Staging: https://api-staging.your.domain

## Known issues

**Alias already exists:**
When you destroy the stack and recreate it, you need to delete an alias used for KMS:
You need to remove an alias for each stage. Look or this in the CDK error message.
```
aws kms delete-alias --alias-name alias/codepipeline-apiapipipeline110f86f3 --profile baseline --region us-east-1
```

**S3 bucket for static assets already exists:**
You can manually delete the buckets in the AWS S3 console.

## Using other AWS services as part of the deployment stages.
Right now, CDK doesn't support automatic provisioning of AWS accounts.
If you want to use for example DynamoDB for your service, it is recommended to separate instances for staging/production through accounts.
For this you need to manually create accounts and reference those here.

## Useful commands

 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

# Hurricane

> Setup a complete bootstrapped service architecture on AWS in just a few minutes.

Hurricane helps you to setup a complete service architecure based on best practices on AWS. It currently provisions three service types for you: A web-service, and api-service and static-assets. Each of the services come with a pipeline, staging and production environments. Things like SSL and `http` to `https` redirection come out of the box 🎉. 

## Usage
Follow the below prerequisites for you to spin up this stack.

### 1. Buy a domain where you can manage DNS

### 2. Create a GitHub API token
1. Go to [GitHub](https://github.com/settings/tokens) and create an API key. The key needs to include all `repo` and all `admin:repo_hook` permission. 
2. Store key in AWS Secret manager. Name the key as you like and paste the GitHub key as a value.

### 3. Create ACM certificate
1. Create a certificate for your domain using ACM. This is for free!
1. Get the ARN of the certificate you just created.

### 4. Setup `cdk.context.json`
Copy `cdk.context.template.json` to `cdk.context.json` and fill in the correct values.

### 5. Setup the application repos
You can deploy any application which includes an `appspec.yml` (CodeDeploy) and a `buildspec.yml` (CodeBuild) in the root of the repository.
TODO: provide sample applications.

### 6. Deploy the stack
```
cdk deploy --profile YOUR_CREDENTIAL_PROFILE
```

### 7. Update your DNS records to point to the Rout53 entries

### 8. Profit 🎉

## Known issues

**Alias already exists**
When you destroy the stack and recreate it, you need to delete an alias used for KMS:
You need to remove an alias for each stage. Look or this in the CDK error message.
```
aws kms delete-alias --alias-name ALIAS --profile YOUR_CREDENTIAL_PROFILE --region AWS_REGION
```

**S3 bucket for static assets already exists**
You can manually delete the buckets in the AWS S3 console.

## TODO
* [ ] Run own NAT gateway to reduce cost (https://hackernoon.com/dealing-with-an-aws-billing-surprise-beware-the-defaults-d8a95f6635a2)
* [ ] Move services/stages into their own accounts and define account structure for shared infra like Route53. 

## Useful commands

 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

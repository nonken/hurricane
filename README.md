# Hurricane

> Setup a complete bootstrapped service architecture on AWS in just a few minutes.

Hurricane provisions three service types for you: A simple web-service, and api-service and static-assets.
Each of the services come with a pipeline, staging and production environments.
Things like SSL and http to https redirect come out of the box 🎉.

> ⚠️ This is work in progress and regularly updated. 

## Usage
There are only a few prerequisites for you to spin up this stack.

### 1. Buy a domain where you can manage DNS

### 2. Create a GitHub API token
1. Go to github and create an API key.
2. Store key in AWS Secret manager.

### 3. Create ACM certificate
1. Get the ARN of the certificate you'd like to use.

### 4. Setup `cdk.context.json`
Copy `cdk.context.template.json` to `cdk.context.json` and fill in the correct values.

### 5. Deploy the stack
```
cdk deploy --profile YOUR_CREDENTIAL_PROFILE
```

### 6. Update your DNS records to point to the Rout53 entries

### 7. Profit 🎉

## Known issues

When you destroy the stack and recreate it, you need to delete an alias used for KMS:

```
aws kms delete-alias --alias-name ALIAS --profile YOUR_CREDENTIAL_PROFILE --region AWS_REGION
```

## TODO
* [ ] Run own NAT gateway to reduce cost (https://hackernoon.com/dealing-with-an-aws-billing-surprise-beware-the-defaults-d8a95f6635a2)

## Useful commands

 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

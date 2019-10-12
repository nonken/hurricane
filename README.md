# AWS Infrastructure Setup
This project allows you to setup a complete stack on AWS with following characteristics.

1. Three different components.
A classic webservice, delivering your webpages.
An API service which the webservice can communicate with. 
A CDN for static asset delivery

2. CI/CD for each of the components, with staging and production stages.

3. SSL and HTTP to HTTPS redirect out of the box.

## Getting started
There are only a few prerequisites for you to spin up this stack.

### 1. Buy a domain where you can manage the DNS

### 2. Create GitHub token
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

### 7. Profit 

## Known issues

When you destroy the stack and recreate it, you need to delete an alias used for KMS:

```
aws kms delete-alias --alias-name ALIAS --profile YOUR_CREDENTIAL_PROFILE --region AWS_REGION
```

## TODO
* [x] Redirect HTTP to HTTPS
* [ ] Pipeline for static assets
* [ ] Run own NAT gateway to reduce cost (https://hackernoon.com/dealing-with-an-aws-billing-surprise-beware-the-defaults-d8a95f6635a2)

## Useful commands

 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

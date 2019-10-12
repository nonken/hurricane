# Project setup

## Buy a domain where you can manage the DNS

## Create GitHub token
1. Go to github and create an API key.
2. Store key in AWS Secret manager.

## Create ACM certificate
1. Get the ARN of the certificate you'd like to use.

## Setup `cdk.context.json` with the following content
```
"context": {
    "stackName": "STACKNAME",
    "zoneName": "YOUR.DOMAIN",
    "certificateArns": ["ARN_FOR_CERTIFICATE_FOR_YOUR_DOMAIN"],
    "githubTokenSecretArn": "ARN_FOR_GITHUB_SECRET_IN_SECRETS_MANAGER",
    "githubTokenFieldName": "GITHUB_SECRET_FIELD_NAME",
    "githubOwner": "GITHUB_OWNER",
    "githubRepo": "GITHUB_REPO",
    "githubBranch": "GITHUB_BRANCH",
    "stages": {
      "staging": {
        "hostName": "STAGING.YOUR.DOMAIN",
        "stageName": "Staging",
        "priority": 1
      },
      "production": {
        "hostName": "YOUR.DOMAIN",
        "stageName": "Production",
        "priority": 2,
        "cname": {
          "recordName": "www",
          "priority": 3
        }
      }
    }
  }
```

## Deploy the stack
```
cdk deploy --profile YOUR_CREDENTIAL_PROFILE
```

## Update your DNS records to point to the Rout53 entries

## Profit 

# Known issues

When you destroy the stack and recreate it, you need to delete an alias used for KMS:

```
aws kms delete-alias --alias-name ALIAS --profile YOUR_CREDENTIAL_PROFILE --region AWS_REGION
```

# TODO
* [x] Redirect HTTP to HTTPS
* [ ] Pipeline for static assets
* [ ] Run own NAT gateway to reduce cost (https://hackernoon.com/dealing-with-an-aws-billing-surprise-beware-the-defaults-d8a95f6635a2)

# Useful commands

 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

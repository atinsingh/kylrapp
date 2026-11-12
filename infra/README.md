# Infrastructure (AWS ca-central-1)

Terraform lives here. Nothing is provisioned yet; this is the plan the modules will implement.

```
infra/
  modules/
    network/      VPC, 3 AZs, private subnets, NAT, VPC endpoints (S3, Secrets Manager, Bedrock)
    data/         RDS Postgres 16 + PostGIS (Multi-AZ, KMS, PITR 35 days), ElastiCache Redis
    storage/      s3 docs (versioned, KMS) · s3 records (Object Lock COMPLIANCE, 5-year default retention)
    services/     ECS Fargate: api, worker, web, pro, admin; ALB; CloudFront + WAF; ECR
    identity/     IAM roles per service, GitHub OIDC deploy role
    observability/ CloudWatch logs and alarms, OTel collector
  envs/
    dev/  staging/  prod/     one AWS account each, S3 + DynamoDB state backend
```

Rules:

* Every resource lives in `ca-central-1`. The only cross-region exception is CloudFront edge caching of public, non-personal assets.
* `admin` is not internet-facing: internal ALB, reached through SSO and the VPN.
* The records bucket is created with Object Lock enabled. This can't be switched on later without recreating the bucket.
* The app's DB role has no UPDATE/DELETE on `audit_log`.

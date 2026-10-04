# calculator-aws

A static calculator (React + Vite) deployed to AWS as files in a private S3 bucket served through
CloudFront. All arithmetic runs in the browser — there is no backend, no API and no container in the
deployed system.

```
npm run build   ->  web/dist/
        |
  CDK BucketDeployment
        |
  S3 (private)  <--OAC--  CloudFront  -->  https://<id>.cloudfront.net
```

## Layout

| Path | What it is |
| --- | --- |
| `web/` | React + Vite app. `src/calc.ts` holds the arithmetic as a pure state machine; `src/Calculator.tsx` renders it. |
| `infra/` | AWS CDK app (TypeScript). One stack: `CalculatorSiteStack`. |
| `Dockerfile`, `docker-compose.yml` | Local development only — not used by any AWS deploy. |

## Setup

```bash
npm run install:all      # installs web/ and infra/ dependencies
```

## Local development

```bash
npm run dev              # http://localhost:5173
npm test                 # vitest over the calculator logic
npm run build            # typecheck + production bundle into web/dist/
```

The keypad and the keyboard go through the same actions: digits, `+ - * /`, `Enter` or `=` to
evaluate, `Esc` or `c` to clear, `Backspace` to delete, `%` for percent, `n` to negate.

### With Docker (optional)

```bash
npm run docker:dev       # dev server on :5173, no Node needed on the host
npm run docker:build     # builds web/dist inside a pinned Node image
```

Neither is required. `npm run deploy` builds on the host and uploads `web/dist`; the container is
just another way to produce that same directory.

## Deploying to AWS

One-time prerequisites:

1. **Credentials** — `aws configure` (or SSO login). Check with `aws sts get-caller-identity`.
2. **Bootstrap CDK** in the target account, once:
   ```bash
   npx cdk bootstrap aws://<account-id>/us-east-1 --cwd infra
   ```

Then:

```bash
npm run deploy           # builds the site, then cdk deploy
```

The stack prints its outputs when it finishes:

- `SiteUrl` — open this
- `DistributionDomainName`, `DistributionId`, `BucketName`

Every deploy re-uploads `web/dist` and invalidates the CloudFront cache, so changes are live as soon
as the command returns.

To tear everything down:

```bash
npm run destroy
```

### Stack details

Region is pinned to **us-east-1** (CloudFront requires its certificates there). The bucket blocks all
public access and is readable only by the distribution via Origin Access Control — the S3 URL itself
returns 403. CloudFront maps 403/404 to `/index.html` with a 200 so client-side routes keep working
if the app ever grows past a single page.

### Custom domain (optional)

The stack takes a domain through CDK context. With a Route 53 public hosted zone you control:

```bash
npm run build
npm --prefix infra run deploy -- \
  -c domainName=calc.example.com \
  -c hostedZoneId=Z123EXAMPLE
```

CDK requests an ACM certificate and writes the DNS validation record into the zone itself; the first
deploy waits a few minutes for validation. Both values must be given together. If the domain is
registered outside Route 53, point the registrar's nameservers at the hosted zone's NS records first.

## Cost

At low traffic this is cents per month — CloudFront requests plus a few KB of S3 storage, often
inside the free tier. `npm run destroy` removes the bucket and the distribution.

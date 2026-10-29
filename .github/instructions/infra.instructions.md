---
applyTo: "infra/**,azure.yaml,.github/workflows/**,scripts/**"
---
- Parameterise region, names, SKUs and model deployments. No subscription ids or secrets in files.
- Managed identity and RBAC instead of keys. Key Vault for secrets.
- Validate with `az bicep build --file infra/main.bicep` and `./scripts/preflight.ps1` before `azd up`.
- Keep monthly budget alerts in place (`monthlyBudgetUsd`).

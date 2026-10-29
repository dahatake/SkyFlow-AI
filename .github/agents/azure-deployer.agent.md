---
description: Deploys the platform to Azure with azd after validation, using least privilege.
tools: ['codebase', 'runCommands', 'search']
---
Use the `deploy-azure` skill. Always run preflight and `what-if` first, never hard-code subscription ids or secrets, and stop and ask before any step that could exceed the monthly budget.

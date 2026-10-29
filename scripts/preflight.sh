#!/usr/bin/env bash
# Pre-deployment checks for `azd up` (login, subscription, providers, region, model quota).
# Usage: ./scripts/preflight.sh [subscriptionId]   (env: AZURE_LOCATION FOUNDRY_LOCATION FOUNDRY_MODEL_* ...)
set -u
SUB="${1:-${AZURE_SUBSCRIPTION_ID:-}}"
LOC="${AZURE_LOCATION:-eastasia}"
FLOC="${FOUNDRY_LOCATION:-eastus2}"
PM="${FOUNDRY_MODEL_PRIMARY:-gpt-4.1}"; PSKU="${FOUNDRY_MODEL_PRIMARY_SKU:-GlobalStandard}"; PCAP="${FOUNDRY_MODEL_PRIMARY_CAPACITY:-50}"
FM="${FOUNDRY_MODEL_FAST:-gpt-4.1-mini}"; FSKU="${FOUNDRY_MODEL_FAST_SKU:-GlobalStandard}"; FCAP="${FOUNDRY_MODEL_FAST_CAPACITY:-100}"
errors=0
ok()   { printf '[ OK ] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { errors=$((errors+1)); printf '[FAIL] %s\n' "$1"; [ -n "${2:-}" ] && printf '       Fix: %s\n' "$2"; }

for t in az azd jq; do
  if command -v "$t" >/dev/null 2>&1; then ok "$t installed"; else fail "$t not found" "install $t"; fi
done
[ "$errors" -gt 0 ] && exit 1

az account show --query id -o tsv >/dev/null 2>&1 || { fail "az is not logged in" "az login"; exit 1; }
ok "az logged in"
azd auth login --check-status >/dev/null 2>&1 && ok "azd logged in" || fail "azd is not logged in" "azd auth login"

if [ -n "$SUB" ]; then
  az account set --subscription "$SUB" 2>/dev/null || { fail "Subscription $SUB not accessible" "az login; az account list -o table"; exit 1; }
else
  warn "No subscription id given; set one explicitly (azd env set AZURE_SUBSCRIPTION_ID <id>)."
fi
ok "Using subscription $(az account show --query id -o tsv)"

providers="Microsoft.App Microsoft.ContainerRegistry Microsoft.CognitiveServices Microsoft.DocumentDB Microsoft.KeyVault Microsoft.OperationalInsights Microsoft.Insights Microsoft.Web Microsoft.ManagedIdentity Microsoft.Network Microsoft.Consumption Microsoft.Authorization"
states=$(az provider list --query "[].{n:namespace,s:registrationState}" -o json)
for p in $providers; do
  s=$(echo "$states" | jq -r --arg p "$p" '.[] | select(.n==$p) | .s')
  if [ "$s" = "Registered" ]; then ok "Provider $p registered"; else fail "Provider $p is '${s:-unknown}'" "az provider register --namespace $p --wait"; fi
done

locs=$(az account list-locations --query "[].name" -o tsv)
for l in $(printf '%s\n' "$LOC" "$FLOC" | sort -u); do
  echo "$locs" | grep -qx "$l" && ok "Region $l exists" || fail "Region '$l' not available" "az account list-locations -o table"
done
case "$LOC" in westus2|centralus|eastus2|westeurope|eastasia) ;; *) warn "Static Web Apps is only in westus2, centralus, eastus2, westeurope, eastasia; '$LOC' may fail." ;; esac

if [ "${DEPLOY_MODELS:-true}" != "false" ]; then
  usage=$(az cognitiveservices usage list --location "$FLOC" -o json 2>/dev/null || echo '[]')
  models=$(az cognitiveservices model list --location "$FLOC" -o json 2>/dev/null || echo '[]')
  check_model() {
    name=$1; sku=$2; cap=$3
    n=$(echo "$models" | jq --arg n "$name" --arg s "$sku" '[.[] | select(.model.name==$n and (.model.skus // [] | map(.name) | index($s)))] | length')
    if [ "$n" = "0" ]; then fail "Model '$name' ($sku) not offered in $FLOC" "az cognitiveservices model list -l $FLOC -o table"; return; fi
    free=$(echo "$usage" | jq --arg k "OpenAI.$sku.$name" '[.[] | select(.name.value==$k)] | if length==0 then "na" else (.[0].limit - .[0].currentValue | floor) end')
    if [ "$free" = '"na"' ]; then warn "No quota record for OpenAI.$sku.$name in $FLOC; verify in Foundry portal."
    elif [ "$free" -ge "$cap" ]; then ok "Quota OpenAI.$sku.$name: $free K TPM free (need $cap)"
    else fail "Quota OpenAI.$sku.$name: only $free K TPM free, need $cap" "Lower FOUNDRY_MODEL_*_CAPACITY or request quota: https://aka.ms/oai/stuquotarequest"; fi
  }
  check_model "$PM" "$PSKU" "$PCAP"
  check_model "$FM" "$FSKU" "$FCAP"
fi

if [ "$errors" -gt 0 ]; then echo; echo "$errors check(s) failed."; exit 1; fi
echo; echo "Preflight passed."

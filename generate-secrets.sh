#!/bin/bash
# ══════════════════════════════════════════════════════════════════
#  generate-secrets.sh — Create K8s secrets securely
#  Run ONCE before: kubectl apply -f k8s/
#  Usage: bash generate-secrets.sh
# ══════════════════════════════════════════════════════════════════

set -e

NAMESPACE="banking"
echo "🔐 Generating secure secrets for namespace: $NAMESPACE"
echo ""

# ── Generate strong random values ─────────────────────────────────
MONGO_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)
JWT_SECRET=$(openssl rand -hex 64)

echo "✅ Generated:"
echo "   MONGO_PASS : $MONGO_PASS"
echo "   JWT_SECRET : [hidden — saved to .secrets.env]"
echo ""

# Save locally (gitignored!)
cat > .secrets.env << EOF
# Generated: $(date)
# KEEP THIS FILE SAFE — DO NOT COMMIT TO GIT
MONGO_ROOT_PASS=$MONGO_PASS
JWT_SECRET=$JWT_SECRET
MONGO_URI=mongodb://admin:${MONGO_PASS}@mongodb-service:27017/bankingdb?authSource=admin
EOF

echo "✅ Saved to .secrets.env (gitignored)"

# ── Create namespace ──────────────────────────────────────────────
kubectl get namespace $NAMESPACE &>/dev/null \
  || kubectl create namespace $NAMESPACE
echo "✅ Namespace '$NAMESPACE' ready"

# ── Delete old secrets if they exist ─────────────────────────────
kubectl delete secret mongo-secret   -n $NAMESPACE --ignore-not-found &>/dev/null
kubectl delete secret backend-secret -n $NAMESPACE --ignore-not-found &>/dev/null

# ── Create MongoDB secret ─────────────────────────────────────────
kubectl create secret generic mongo-secret \
  --from-literal=MONGO_ROOT_USER=admin \
  --from-literal=MONGO_ROOT_PASS="$MONGO_PASS" \
  -n $NAMESPACE

echo "✅ mongo-secret created"

# ── Create Backend secret ─────────────────────────────────────────
kubectl create secret generic backend-secret \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=MONGO_URI="mongodb://admin:${MONGO_PASS}@mongodb-service:27017/bankingdb?authSource=admin" \
  -n $NAMESPACE

echo "✅ backend-secret created"
echo ""
echo "══════════════════════════════════════════════"
echo "✅ ALL SECRETS CREATED SUCCESSFULLY!"
echo ""
echo "📋 Next steps:"
echo "   1. Update k8s/01-mongodb.yaml password to: $MONGO_PASS"
echo "   2. Replace YOURDOCKERHUBUSER in k8s/02-backend.yaml and k8s/03-frontend.yaml"
echo "   3. kubectl apply -f k8s/"
echo "   4. kubectl get pods -n $NAMESPACE"
echo "══════════════════════════════════════════════"

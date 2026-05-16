# 🏦 NovaBanc — Three-Tier Banking Application

## Stack
| Layer | Tech |
|-------|------|
| Frontend | HTML + CSS + Vanilla JS + Nginx |
| Backend | Node.js + Express + MongoDB |
| CI/CD | Jenkins (Groovy Pipeline) |
| Containers | Docker + Docker Compose |
| Orchestration | Kubernetes |
| Monitoring | Prometheus + Grafana |

---

## 🚀 Local Test (Docker Compose)

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/banking-app.git
cd banking-app

# 2. Start everything
docker compose up --build

# 3. Open browser
# Site:    http://localhost
# Backend: http://localhost:5000/health
# Metrics: http://localhost:5000/metrics
```

Register a new user → Login → Transfer money ✅

---

## ☸️ Kubernetes Deploy

```bash
# 1. Generate secrets (run ONCE)
bash generate-secrets.sh

# 2. Replace YOURDOCKERHUBUSER in k8s files
sed -i 's/YOURDOCKERHUBUSER/your_username/g' k8s/02-backend.yaml k8s/03-frontend.yaml

# 3. Apply all
kubectl apply -f k8s/

# 4. Watch pods
kubectl get pods -n banking -w

# 5. Access (minikube)
minikube service banking-frontend-service -n banking
```

---

## 🔧 Jenkins Setup

1. Install plugins: Pipeline, Docker Pipeline, NodeJS, Kubernetes CLI
2. Add credentials: `dockerhub-credentials`, `kubeconfig-credentials`
3. Add NodeJS tool: name = `NodeJS-20`
4. New Pipeline job → SCM → your GitHub repo → Jenkinsfile
5. Add GitHub Webhook → `http://JENKINS_IP:8080/github-webhook/`

Now every `git push` to `main` → auto build + deploy! 🚀

---

## 📊 Monitoring

```bash
# Grafana (local)
kubectl port-forward svc/grafana-service 3000:3000 -n monitoring
# Open: http://localhost:3000
# Login: admin / Grafana@1234
# Add datasource: Prometheus → http://prometheus-service:9090
# Import dashboard ID: 1860
```

---

## 🌐 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login, get JWT |
| GET | `/api/account/balance` | ✅ | Get balance |
| GET | `/api/account/profile` | ✅ | Get profile |
| GET | `/api/transactions` | ✅ | List transactions |
| POST | `/api/transactions/transfer` | ✅ | Transfer money |
| GET | `/health` | ❌ | Health check |
| GET | `/metrics` | ❌ | Prometheus metrics |

---

## Demo Login
After `docker compose up`, register a new account at `http://localhost`

// ══════════════════════════════════════════════════════════════════
//  NovaBanc — Jenkinsfile
//  Full CI/CD: GitHub → Test → Docker Build → Push → K8s Deploy
//
//  Required Jenkins credentials:
//    - dockerhub-credentials  (Username/Password)
//    - github-credentials     (Username/Password or SSH)
//    - kubeconfig-credentials (Secret File)
//
//  Required Jenkins plugins:
//    - Pipeline, Git, Docker Pipeline, Kubernetes CLI,
//      NodeJS, HTML Publisher
// ══════════════════════════════════════════════════════════════════

pipeline {

    agent any

    tools {
        nodejs 'NodeJS-20'   // Configured in Jenkins > Tools > NodeJS
    }

    environment {
        // ── Docker ────────────────────────────────────────────────
        DOCKERHUB_CREDS  = 'dockerhub-credentials'
        DOCKERHUB_USER   = ''   // set dynamically from credentials
        IMAGE_FRONTEND   = 'banking-frontend'
        IMAGE_BACKEND    = 'banking-backend'
        IMAGE_TAG        = "${env.BUILD_NUMBER}"

        // ── Kubernetes ────────────────────────────────────────────
        KUBECONFIG_CREDS = 'kubeconfig-credentials'
        K8S_NAMESPACE    = 'banking'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '15'))
        timeout(time: 45, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    triggers {
        // GitHub webhook (preferred) — also poll as fallback
        pollSCM('H/5 * * * *')
    }

    stages {

        // ── Stage 1: Checkout ──────────────────────────────────────
        stage('Checkout') {
            steps {
                echo "📥 Branch: ${env.GIT_BRANCH}"
                echo "📝 Commit: ${env.GIT_COMMIT}"
                checkout scm
            }
        }

        // ── Stage 2: Install Backend Dependencies ──────────────────
        stage('Install') {
            steps {
                dir('backend') {
                    // Use npm install (works with or without lock file)
                    // If package-lock.json exists, use npm ci for speed
                    sh '''
                        if [ -f package-lock.json ]; then
                            echo "Lock file found — using npm ci"
                            npm ci 
                        else
                            echo "No lock file — using npm install"
                            npm install 
                        fi
                    '''
                }
            }
        }

        // ── Stage 3: Run Tests ─────────────────────────────────────
        stage('Test') {
            steps {
                dir('backend') {
                    sh 'npm test -- --ci --forceExit 2>&1 || true'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true,
                          testResults: 'backend/coverage/junit.xml'
                }
            }
        }

        // ── Stage 4: Build Docker Images ───────────────────────────
        stage('Docker Build') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: DOCKERHUB_CREDS,
                    usernameVariable: 'DH_USER',
                    passwordVariable: 'DH_PASS'
                )]) {
                    script {
                        def tag = "${DH_USER}/${IMAGE_FRONTEND}:${IMAGE_TAG}"
                        def tagLatest = "${DH_USER}/${IMAGE_FRONTEND}:latest"
                        echo "================ DEBUG ================"
                        echo "DH_USER = ${DH_USER}"
                        echo "TAG = ${tag}"
                        echo "TAG_LATEST = ${tagLatest}"

                        // Build Frontend
                        sh """
                            docker build \
                              -t ${tag} \
                              -t ${tagLatest} \
                              ./frontend
                        """

                        // Build Backend
                        sh """
                            docker build \
                              -t ${DH_USER}/${IMAGE_BACKEND}:${IMAGE_TAG} \
                              -t ${DH_USER}/${IMAGE_BACKEND}:latest \
                              ./backend
                        """

                        // Save user for later stages
                        env.DH_USERNAME = DH_USER
                    }
                }
            }
        }

        // ── Stage 5: Security Scan (only on main) ──────────────────
        stage('Security Scan') {
    
            steps {
                sh '''
                    trivy fs --exit-code 0 --severity HIGH,CRITICAL ./backend || true
                '''
            }
        }

        // ── Stage 6: Push to Docker Hub ────────────────────────────
        stage('Docker Push') {
            
            steps {
                withCredentials([usernamePassword(
                    credentialsId: DOCKERHUB_CREDS,
                    usernameVariable: 'DH_USER',
                    passwordVariable: 'DH_PASS'
                )]) {
                    sh """
                        echo "\$DH_PASS" | docker login -u "\$DH_USER" --password-stdin

                        docker push \$DH_USER/${IMAGE_FRONTEND}:${IMAGE_TAG}
                        docker push \$DH_USER/${IMAGE_FRONTEND}:latest

                        docker push \$DH_USER/${IMAGE_BACKEND}:${IMAGE_TAG}
                        docker push \$DH_USER/${IMAGE_BACKEND}:latest

                        docker logout
                    """
                }
            }
        }

        // ── Stage 7: Deploy to Kubernetes ──────────────────────────
        stage('Deploy to K8s') {
            when {
                anyOf { branch 'main'; branch 'master' }
            }
            steps {
                withCredentials([
            
                    usernamePassword(
                        credentialsId: DOCKERHUB_CREDS,
                        usernameVariable: 'DH_USER',
                        passwordVariable: 'DH_PASS'
                    )
                ]) {
                    sh """
                        # Create namespace if not exists
                        kubectl get namespace ${K8S_NAMESPACE} || \
                          kubectl create namespace ${K8S_NAMESPACE}

                        # Apply MongoDB and secrets first
                        kubectl apply -f k8s/01-mongodb.yaml

                        # Apply backend (secure version)
                        kubectl apply -f k8s/02-backend.yaml

                        # Apply frontend
                        kubectl apply -f k8s/03-frontend.yaml

                        # Apply monitoring
                        kubectl apply -f k8s/04-monitoring.yaml || true

                        # Rolling update with new image tags
                        kubectl set image deployment/banking-frontend \
                          frontend=\$DH_USER/${IMAGE_FRONTEND}:${IMAGE_TAG} \
                          -n ${K8S_NAMESPACE} || true

                        kubectl set image deployment/banking-backend \
                          backend=\$DH_USER/${IMAGE_BACKEND}:${IMAGE_TAG} \
                          -n ${K8S_NAMESPACE} || true

                        # Wait for rollout
                        kubectl rollout status deployment/banking-frontend \
                          -n ${K8S_NAMESPACE} --timeout=180s

                        kubectl rollout status deployment/banking-backend \
                          -n ${K8S_NAMESPACE} --timeout=180s
                    """
                }
            }
        }

        // ── Stage 8: Smoke Test ────────────────────────────────────
        stage('Smoke Test') {
            when {
                anyOf { branch 'main'; branch 'master' }
            }
            steps {
                withCredentials([file(credentialsId: KUBECONFIG_CREDS, variable: 'KUBECONFIG')]) {
                    sh """
                        echo "⏳ Waiting for pods to be ready..."
                        sleep 15

                        # Get backend service cluster IP
                        BACKEND_IP=\$(kubectl get svc banking-backend-service \
                          -n ${K8S_NAMESPACE} \
                          -o jsonpath='{.spec.clusterIP}')

                        echo "🔍 Testing backend health at \$BACKEND_IP:5000/health"
                        curl -sf --max-time 10 http://\$BACKEND_IP:5000/health | \
                          python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('status')=='ok' else 1)"

                        echo "✅ Smoke test PASSED!"
                    """
                }
            }
        }

    }

    // ── Post Actions ───────────────────────────────────────────────
    post {
        success {
            echo "✅ Pipeline SUCCEEDED — Build #${env.BUILD_NUMBER}"
        }
        failure {
            echo "❌ Pipeline FAILED — Check logs above"
            // Uncomment to send notifications:
            // mail to: 'team@yourdomain.com',
            //      subject: "❌ Build Failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            //      body: "Check: ${env.BUILD_URL}"
        }
        always {
            // Clean docker images to save disk space
            sh 'docker image prune -f || true'
            cleanWs()
        }
    }
}

pipeline {
    agent any
    
    environment {
        DOCKER_HUB_USER = 'angelicazywang'  // 請替換為你的 Docker Hub 用戶名
        DOCKER_HUB_CREDENTIALS = 'dockerhub-credentials'  // Jenkins 中配置的 Docker Hub 憑證 ID
        SLACK_WEBHOOK_CREDENTIALS = 'slack-webhook-credentials'  // Jenkins 中配置的 Slack Webhook URL 憑證 ID
        YOUR_NAME = 'Zhiying Wang'  // 請替換為你的姓名
        YOUR_STUDENT_ID = 'B12705031'  // 請替換為你的學號
        PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"  // 確保能找到 npm 和 node
    }
    
    stages {
        // Stage 0: Install Dependencies
        stage('Install Dependencies') {
            steps {
                script {
                    echo "Installing npm dependencies..."
                    // 確保能找到 npm（檢查多個可能的路徑）
                    sh '''
                        if command -v npm &> /dev/null; then
                            npm install
                        elif [ -f /usr/local/bin/npm ]; then
                            /usr/local/bin/npm install
                        elif [ -f /opt/homebrew/bin/npm ]; then
                            /opt/homebrew/bin/npm install
                        else
                            echo "Error: npm not found. Please install Node.js."
                            exit 1
                        fi
                    '''
                }
            }
        }
        
        // Stage 1: Static Analysis (Linting) - 在所有分支上運行
        stage('Static Analysis') {
            steps {
                script {
                    echo "Running ESLint on branch: ${env.BRANCH_NAME}"
                    sh '''
                        if command -v npm &> /dev/null; then
                            npm run lint
                        elif [ -f /usr/local/bin/npm ]; then
                            /usr/local/bin/npm run lint
                        elif [ -f /opt/homebrew/bin/npm ]; then
                            /opt/homebrew/bin/npm run lint
                        else
                            echo "Error: npm not found."
                            exit 1
                        fi
                    '''
                }
            }
            post {
                failure {
                    script {
                        // 發送失敗通知到 Slack
                        withCredentials([string(credentialsId: SLACK_WEBHOOK_CREDENTIALS, variable: 'SLACK_WEBHOOK_URL')]) {
                            sendSlackNotification('FAILURE', env.SLACK_WEBHOOK_URL)
                        }
                    }
                }
            }
        }
        
        // Stage 2: Build and Deploy (根據分支不同而異)
        stage('Build and Deploy') {
            when {
                anyOf {
                    branch 'dev'
                    branch 'main'
                }
            }
            steps {
                script {
                    if (env.BRANCH_NAME == 'dev') {
                        // Staging Environment (dev branch)
                        echo "Building and deploying to Staging..."
                        
                        // 0. Read version from package.json (Bonus: Semantic Versioning)
                        def appVersion = sh(
                            script: '''
                                if command -v npm &> /dev/null; then
                                    npm pkg get version | tr -d '"'
                                elif [ -f /usr/local/bin/npm ]; then
                                    /usr/local/bin/npm pkg get version | tr -d '"'
                                elif [ -f /opt/homebrew/bin/npm ]; then
                                    /opt/homebrew/bin/npm pkg get version | tr -d '"'
                                else
                                    node -p "require('./package.json').version"
                                fi
                            ''',
                            returnStdout: true
                        ).trim()
                        echo "App version from package.json: ${appVersion}"
                        
                        // 1. Build Docker image
                        def imageTag = "dev-${env.BUILD_NUMBER}"
                        def versionTag = "v${appVersion}"
                        sh """
                            docker build -t ${DOCKER_HUB_USER}/myapp:${imageTag} .
                            docker tag ${DOCKER_HUB_USER}/myapp:${imageTag} ${DOCKER_HUB_USER}/myapp:latest
                            docker tag ${DOCKER_HUB_USER}/myapp:${imageTag} ${DOCKER_HUB_USER}/myapp:${versionTag}
                        """
                        
                        // 2. Push to Docker Hub
                        withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                            sh """
                                echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin
                                docker push ${DOCKER_HUB_USER}/myapp:${imageTag}
                                docker push ${DOCKER_HUB_USER}/myapp:latest
                                docker push ${DOCKER_HUB_USER}/myapp:${versionTag}
                            """
                        }
                        
                        // 3. Cleanup existing container
                        sh 'docker rm -f dev-app || true'
                        
                        // 4. Deploy container on Port 8081
                        sh """
                            docker run -d --name dev-app -p 8081:3000 ${DOCKER_HUB_USER}/myapp:${imageTag}
                        """
                        
                        // 5. Verify health endpoint
                        sh 'sleep 5'  // 等待容器啟動
                        sh 'curl -f http://localhost:8081/health || exit 1'
                        
                    } else if (env.BRANCH_NAME == 'main') {
                        // Production Environment (main branch) - GitOps workflow
                        echo "Reading deploy.config for GitOps promotion..."
                        
                        // 1. Read deploy.config
                        def deployConfig = readFile('deploy.config').trim()
                        def targetTag = deployConfig
                        echo "Target tag from deploy.config: ${targetTag}"
                        
                        // 2. Pull the image specified in config
                        withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                            sh """
                                echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin
                                docker pull ${DOCKER_HUB_USER}/myapp:${targetTag}
                            """
                        }
                        
                        // 3. Retag as production
                        def prodTag = "prod-${env.BUILD_NUMBER}"
                        sh """
                            docker tag ${DOCKER_HUB_USER}/myapp:${targetTag} ${DOCKER_HUB_USER}/myapp:${prodTag}
                        """
                        
                        // 4. Push new production tag
                        withCredentials([usernamePassword(credentialsId: DOCKER_HUB_CREDENTIALS, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                            sh """
                                echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin
                                docker push ${DOCKER_HUB_USER}/myapp:${prodTag}
                            """
                        }
                        
                        // 5. Cleanup old prod-app container
                        sh 'docker rm -f prod-app || true'
                        
                        // 6. Deploy on Port 8082
                        sh """
                            docker run -d --name prod-app -p 8082:3000 ${DOCKER_HUB_USER}/myapp:${prodTag}
                        """
                        
                        // 7. Verify health endpoint
                        sh 'sleep 5'  // 等待容器啟動
                        sh 'curl -f http://localhost:8082/health || exit 1'
                    }
                }
            }
        }
    }
    
    post {
        always {
            echo "Pipeline completed with status: ${currentBuild.currentResult}"
        }
        failure {
            script {
                withCredentials([string(credentialsId: SLACK_WEBHOOK_CREDENTIALS, variable: 'SLACK_WEBHOOK_URL')]) {
                    sendSlackNotification('FAILURE', env.SLACK_WEBHOOK_URL)
                }
            }
        }
        // success {
        //     script {
        //         // 可選：成功時也發送通知
        //         // withCredentials([string(credentialsId: SLACK_WEBHOOK_CREDENTIALS, variable: 'SLACK_WEBHOOK_URL')]) {
        //         //     sendSlackNotification('SUCCESS', env.SLACK_WEBHOOK_URL)
        //         // }
        //     }
        // }
    }
}

// Slack 通知函數
def sendSlackNotification(String status, String webhookUrl) {
    def color = status == 'FAILURE' ? 'danger' : 'good'  // danger=紅色, good=綠色
    def emoji = status == 'FAILURE' ? '❌' : '✅'
    
    def message = """
${emoji} *Jenkins Build ${status}*

*Name:* ${YOUR_NAME}
*Student ID:* ${YOUR_STUDENT_ID}
*Job Name:* ${env.JOB_NAME}
*Build Number:* ${env.BUILD_NUMBER}
*GitHub Repo URL:* ${env.GIT_URL}
*Branch:* ${env.BRANCH_NAME}
*Status:* ${currentBuild.currentResult}
"""
    
    def payload = [
        text: "Jenkins Build ${status}",
        attachments: [[
            color: color,
            text: message,
            footer: "Jenkins CI/CD",
            ts: System.currentTimeMillis() / 1000
        ]]
    ]
    
    sh """
        curl -X POST ${webhookUrl} \\
        -H 'Content-Type: application/json' \\
        -d '${groovy.json.JsonOutput.toJson(payload)}'
    """
}

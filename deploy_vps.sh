#!/bin/bash
# ==============================================================================
# ReachInbox VPS Deployment Script (Ubuntu 22.04 on Oracle Always Free)
# ==============================================================================
# This script will install Docker, setup kernel parameters for Elasticsearch,
# and prepare the environment for your docker-compose stack.
# Run this on your Oracle VPS after SSHing into it.

set -e

echo "=========================================="
echo "1. System Updates & Docker Installation"
echo "=========================================="
sudo apt update && sudo apt upgrade -y
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common git jq
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add current user to docker group
sudo usermod -aG docker $USER

echo "=========================================="
echo "2. Kernel Tuning (Required for Elasticsearch)"
echo "=========================================="
# Elasticsearch requires vm.max_map_count to be at least 262144
if grep -q "vm.max_map_count" /etc/sysctl.conf; then
    sudo sed -i 's/^vm.max_map_count.*/vm.max_map_count=262144/' /etc/sysctl.conf
else
    echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
fi
sudo sysctl -p

echo "=========================================="
echo "3. Application Setup Instructions"
echo "=========================================="
echo "Deployment environment is ready."
echo ""
echo "Next Steps:"
echo "1. Log out of SSH and log back in (so the docker group change takes effect)."
echo "2. Clone your repository:"
echo "   git clone https://github.com/YOUR_GITHUB_USERNAME/reachinbox-scheduler.git"
echo "3. cd reachinbox-scheduler"
echo "4. Create your backend/.env file from the example:"
echo "   cp backend/.env.example backend/.env"
echo "   nano backend/.env  # fill in Google OAuth and JWT secrets"
echo "5. Modify nginx/nginx.conf and replace YOUR_DOMAIN_HERE with your domain."
echo "6. Start the stack:"
echo "   docker compose -f docker-compose.prod.yml up -d --build"
echo "=========================================="

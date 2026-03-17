#!/usr/bin/env bash
set -euo pipefail

: "${UBT_TEM_VM_NAME:?UBT_TEM_VM_NAME is required}"
: "${UBT_TEM_VM_PASSWORD:?UBT_TEM_VM_PASSWORD is required}"
: "${VM_NAME:?VM_NAME is required}"
: "${VM_USER_NAME:?VM_USER_NAME is required}"
: "${VM_USER_PASSWORD:?VM_USER_PASSWORD is required}"

echo "[$(date +'%d-%m-%y %H:%M:%S')] Đang cấu hình VM: ${VM_NAME}"
govc guest.run -vm "${VM_NAME}" -l "${UBT_TEM_VM_NAME}":"${UBT_TEM_VM_PASSWORD}" /bin/bash -c "
echo '${UBT_TEM_VM_PASSWORD}' | sudo -S bash -c \"
    set -e
    hostnamectl set-hostname '${VM_NAME}'
    sed -i 's/${UBT_TEM_VM_NAME}/${VM_NAME}/g' /etc/hosts

    id -u '${VM_USER_NAME}' >/dev/null 2>&1 || useradd -m -s /bin/bash '${VM_USER_NAME}'
    usermod -aG sudo '${VM_USER_NAME}'
    echo '${VM_USER_NAME}:${VM_USER_PASSWORD}' | chpasswd

    rm -f /etc/ssh/ssh_host_*
    ssh-keygen -A
    systemctl stop ssh.socket || true
    systemctl disable ssh.socket || true
    systemctl restart ssh || systemctl restart sshd
\"
"
echo "[$(date +'%d-%m-%y %H:%M:%S')] Kiểm tra trạng thái SSH"
govc guest.run -vm "${VM_NAME}" -l "${VM_USER_NAME}":"${VM_USER_PASSWORD}" /bin/bash -c "
echo '${VM_USER_PASSWORD}' | sudo -S bash -c \"
    if ! systemctl is-active --quiet ssh; then
        echo 'CRITICAL: SSH Service failed to start!'
        systemctl status ssh --no-pager
        exit 1
    fi
\"
"

echo "[$(date +'%d-%m-%y %H:%M:%S')] Clean up"
govc guest.run -vm "${VM_NAME}" -l "${VM_USER_NAME}":"${VM_USER_PASSWORD}" /bin/bash -c "
echo '${VM_USER_PASSWORD}' | sudo -S bash -c \"
    pkill -u '${UBT_TEM_VM_NAME}' || true
    sleep 2
    deluser --remove-home '${UBT_TEM_VM_NAME}' || userdel -r '${UBT_TEM_VM_NAME}'
\"
"
echo "[$(date +'%d-%m-%y %H:%M:%S')] Success"
#!/usr/bin/env bash
set -euo pipefail

: "${GOVC_DATASTORE:?GOVC_DATASTORE is required}"
: "${UBT_TEM_VM_NAME:?UBT_TEM_VM_NAME is required}"
: "${VM_NAME:?VM_NAME is required}"
: "${UBT_TEM_FILE:?UBT_TEM_FILE is required}"
: "${OS_NAME:?OS_NAME is required}"

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&\\/]/\\&/g'
}
vm_name=$(escape_sed_replacement "${VM_NAME}")

echo "[$(date +'%d-%m-%y %H:%M:%S')] Đang khởi tạo VM: ${VM_NAME}"

echo "[$(date +'%d-%m-%y %H:%M:%S')] Tạo thư mục lưu trữ"
govc datastore.mkdir -ds="${GOVC_DATASTORE}" "${VM_NAME}"

echo "[$(date +'%d-%m-%y %H:%M:%S')] Clone vmdk"
govc datastore.cp \
  -ds="${GOVC_DATASTORE}" \
  "${UBT_TEM_VM_NAME}/${UBT_TEM_VM_NAME}.vmdk" \
  "${VM_NAME}/${VM_NAME}.vmdk"

echo "[$(date +'%d-%m-%y %H:%M:%S')] Upload vmx"
sed "s|${UBT_TEM_FILE}|${vm_name}|g" "src/templates/${OS_NAME}/${UBT_TEM_FILE}.vmx" | \
govc datastore.upload \
  -ds="${GOVC_DATASTORE}" \
  /dev/stdin \
  "${VM_NAME}/${VM_NAME}.vmx"

echo "[$(date +'%d-%m-%y %H:%M:%S')] Register VM"
govc vm.register \
  -ds="${GOVC_DATASTORE}" \
  "${VM_NAME}/${VM_NAME}.vmx"
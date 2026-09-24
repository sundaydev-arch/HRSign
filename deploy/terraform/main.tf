terraform {
  required_version = ">= 1.5"
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

variable "compose_host" {
  type        = string
  description = "SSH host that runs docker compose (active-passive self-host)."
  default     = "hrsign.example.com"
}

variable "ghcr_web_image" {
  type    = string
  default = "ghcr.io/sundaydev-arch/hrsign-web:latest"
}

variable "ghcr_worker_image" {
  type    = string
  default = "ghcr.io/sundaydev-arch/hrsign-worker:latest"
}

# Placeholder: operators typically use cloud provider modules (AWS EC2, Azure VM)
# or Ansible. This null resource documents the intended pull + compose flow.

resource "null_resource" "document_deploy" {
  triggers = {
    web    = var.ghcr_web_image
    worker = var.ghcr_worker_image
    host   = var.compose_host
  }

  provisioner "local-exec" {
    command = "echo \"Pull ${var.ghcr_web_image} + ${var.ghcr_worker_image} on ${var.compose_host}; use docker compose --profile full up -d\""
  }
}

output "promote_path" {
  value = "staging compose → GHCR tag → Helm/prod compose (shared Postgres + MinIO)"
}

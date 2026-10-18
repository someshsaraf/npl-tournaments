#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04/24.04 server — AWS EC2, Oracle
# Cloud, DigitalOcean or any similar VPS. Safe to re-run. From the repo folder:
#
#   sudo ./deploy/setup.sh
#
# It will:
#   1. install Docker + Compose, fail2ban and automatic security updates
#      (with automatic reboots at 04:30 when an update needs one)
#   2. open ports 80/443 in the server firewall (needed on Oracle images;
#      nothing to do on AWS)
#   3. turn off SSH password login (only if you already log in with a key)
#   4. add swap on small machines
#   5. create .env with fresh secrets (asks for your domain + DuckDNS token)
#   6. keep your DuckDNS name pointed at this server
#   7. build + start the site with automatic HTTPS
#   8. create the admin code (shown once) and schedule nightly backups
#
# Non-interactive use: export SITE_DOMAIN, DUCKDNS_TOKEN, COMMUNITY_ACCESS_CODE first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
OWNER="${SUDO_USER:-root}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo $0" >&2; exit 1; }
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || warn "This script is written for Ubuntu (found ${PRETTY_NAME:-unknown}); continuing anyway."

export DEBIAN_FRONTEND=noninteractive

# ─── 1. packages ────────────────────────────────────────────────────────────
say "Installing Docker, firewall persistence, fail2ban and automatic updates"
apt-get update -y
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | debconf-set-selections
apt-get install -y ca-certificates curl git openssl cron iptables-persistent fail2ban unattended-upgrades

if ! docker compose version >/dev/null 2>&1; then
  # Ubuntu's own packages first (patched by unattended-upgrades) …
  if ! apt-get install -y docker.io docker-compose-v2; then
    # … otherwise Docker's official repository.
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    # Let unattended-upgrades patch Docker from that repo too.
    echo 'Unattended-Upgrade::Origins-Pattern { "origin=Docker"; };' > /etc/apt/apt.conf.d/51npl-docker-updates
  fi
fi
systemctl enable --now docker

say "Turning on automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52npl-unattended <<'EOF'
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF
systemctl enable --now unattended-upgrades fail2ban

# ─── 2. firewall ────────────────────────────────────────────────────────────
# Oracle's Ubuntu images end the INPUT chain with a REJECT rule (only SSH is
# open). Open 80/443 live, and in the saved rules file so it survives reboots.
# (We edit the file rather than "netfilter-persistent save", which would also
# freeze Docker's own temporary rules into it.)
say "Opening ports 80 and 443 in the server firewall"
RULES=/etc/iptables/rules.v4
open_port() {
  local proto="$1" port="$2" reject_line
  if ! iptables -C INPUT -p "$proto" -m state --state NEW -m "$proto" --dport "$port" -j ACCEPT 2>/dev/null; then
    reject_line="$(iptables -L INPUT --line-numbers -n | awk '$2=="REJECT" {print $1; exit}')"
    if [ -n "$reject_line" ]; then
      iptables -I INPUT "$reject_line" -p "$proto" -m state --state NEW -m "$proto" --dport "$port" -j ACCEPT
    fi
  fi
  local rule="-A INPUT -p $proto -m state --state NEW -m $proto --dport $port -j ACCEPT"
  if [ -f "$RULES" ] && ! grep -qxF -- "$rule" "$RULES"; then
    # Insert just above the first INPUT REJECT line (if there is one).
    awk -v rule="$rule" '!done && /^-A INPUT .*-j REJECT/ { print rule; done=1 } { print }' "$RULES" > "$RULES.npl" \
      && cat "$RULES.npl" > "$RULES" && rm -f "$RULES.npl"
  fi
}
open_port tcp 80
open_port tcp 443
open_port udp 443

# ─── 3. SSH ─────────────────────────────────────────────────────────────────
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"
if [ -s "$OWNER_HOME/.ssh/authorized_keys" ]; then
  say "Locking SSH to key logins only"
  cat > /etc/ssh/sshd_config.d/10-npl-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
  if sshd -t; then
    systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
  else
    rm -f /etc/ssh/sshd_config.d/10-npl-hardening.conf
    warn "sshd rejected the hardening config — left SSH unchanged."
  fi
else
  warn "No SSH key found for $OWNER — not touching SSH settings."
fi

# ─── 4. swap (small machines, e.g. the 1 GB AMD micro shape) ────────────────
mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
if [ "$mem_kb" -lt 3000000 ] && ! swapon --show | grep -q .; then
  say "Adding 2 GB of swap (this machine has little memory)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ─── 5. .env ────────────────────────────────────────────────────────────────
set_env() { # set KEY=VALUE in .env (value written verbatim)
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -v "^$key=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}
get_env() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1 | sed -e "s/^'\(.*\)'$/\1/"; }

if [ ! -f "$ENV_FILE" ]; then
  say "Creating .env with fresh secrets"
  cp "$ROOT/.env.example" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"
chown "$OWNER" "$ENV_FILE"

[ -n "$(get_env AUTH_JWT_SECRET)" ] || set_env AUTH_JWT_SECRET "$(openssl rand -hex 32)"
[ -n "$(get_env AUTH_PEPPER)" ] || set_env AUTH_PEPPER "$(openssl rand -hex 32)"
set_env MEDIA_STORAGE "$(get_env MEDIA_STORAGE | grep . || echo local)"

domain="${SITE_DOMAIN:-$(get_env SITE_DOMAIN)}"
while [ -z "$domain" ]; do
  read -r -p "Site address (e.g. rnw-sports.duckdns.org): " domain
done
domain="$(printf '%s' "$domain" | tr 'A-Z' 'a-z' | sed -e 's#^https\{0,1\}://##' -e 's#/.*$##')"
set_env SITE_DOMAIN "$domain"

community="${COMMUNITY_ACCESS_CODE:-$(get_env COMMUNITY_ACCESS_CODE)}"
if [ -z "$community" ]; then
  read -r -p "First community access code (6-64 chars, e.g. volley-maple-48): " community
fi
if [ "${#community}" -lt 6 ] || [ "${#community}" -gt 64 ]; then
  echo "The community code must be 6-64 characters." >&2; exit 1
fi
case "$community" in
  *"'"*|*'"'*|*'#'*|*'\'*) echo "Please avoid quotes, # and \\ in the community code." >&2; exit 1 ;;
esac
set_env COMMUNITY_ACCESS_CODE "'$community'"

# ─── 6. DuckDNS ─────────────────────────────────────────────────────────────
case "$domain" in
  *.duckdns.org)
    say "Keeping $domain pointed at this server (DuckDNS, every 5 minutes)"
    install -d -m 700 /etc/npl
    token="${DUCKDNS_TOKEN:-$(sed -n 's/^DUCKDNS_TOKEN=//p' /etc/npl/duckdns 2>/dev/null || true)}"
    while [ -z "$token" ]; do
      read -r -s -p "DuckDNS token (from duckdns.org, hidden): " token; echo
    done
    printf 'DUCKDNS_DOMAIN=%s\nDUCKDNS_TOKEN=%s\n' "${domain%.duckdns.org}" "$token" > /etc/npl/duckdns
    chmod 600 /etc/npl/duckdns
    cat > /usr/local/bin/npl-duckdns-update <<'EOF'
#!/bin/sh
# Points the DuckDNS name at this server's current public IP.
. /etc/npl/duckdns
curl -fsS --max-time 20 "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=" -o /var/log/npl-duckdns.last
EOF
    chmod 700 /usr/local/bin/npl-duckdns-update
    echo "*/5 * * * * root /usr/local/bin/npl-duckdns-update >/dev/null 2>&1" > /etc/cron.d/npl-duckdns
    if /usr/local/bin/npl-duckdns-update && grep -q OK /var/log/npl-duckdns.last; then
      echo "DuckDNS updated."
    else
      warn "DuckDNS update failed — check the subdomain and token at https://www.duckdns.org"
    fi
    ;;
  *)
    warn "$domain isn't a DuckDNS name — point its DNS A record at this server's public IP yourself."
    ;;
esac

# ─── 7. start ───────────────────────────────────────────────────────────────
say "Building and starting the site (first build takes a few minutes)"
"$ROOT/deploy/npl" up

# ─── 8. admin code + backups ────────────────────────────────────────────────
if [ -z "$(get_env ADMIN_CODE_HASH)" ]; then
  say "Creating the admin code"
  "$ROOT/deploy/npl" admin-code
fi
chown "$OWNER" "$ENV_FILE"

say "Scheduling nightly backups (03:30) to /var/backups/npl"
echo "30 3 * * * root $ROOT/deploy/backup.sh >> /var/log/npl-backup.log 2>&1" > /etc/cron.d/npl-backup
systemctl enable --now cron >/dev/null 2>&1 || true

public_ip="$(curl -fsS --max-time 10 https://ifconfig.me 2>/dev/null || echo '?')"
say "Done"
cat <<EOF

  Site:        https://$domain
  Server IP:   $public_ip
  Staff:       open the site and enter the admin code (shown above)

  If the site doesn't load in a few minutes:
    • allow TCP 80 and 443 from anywhere in your cloud firewall
      (AWS: the instance's security group · Oracle: the subnet's security list)
    • check it:  ./deploy/npl status     (and ./deploy/npl logs caddy)

  Everyday commands: ./deploy/npl  (update, backup, logs, status …)
EOF

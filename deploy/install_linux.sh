#!/usr/bin/env bash
# Installation de Maison connectée comme service (Debian / Ubuntu, conteneur LXC Proxmox…)
#
#   1. Copier le dossier du projet sur la machine, par ex. dans /opt/maison
#   2. sudo bash /opt/maison/deploy/install_linux.sh
#
# Le service démarre au boot, redémarre en cas de plantage, et écoute sur le port 8123.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="${SUDO_USER:-maison}"

echo "==> Paquets système"
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip ffmpeg iputils-ping net-tools >/dev/null

if ! id "$USER_NAME" >/dev/null 2>&1; then
  useradd --system --home "$DIR" --shell /usr/sbin/nologin "$USER_NAME"
fi

echo "==> Environnement Python"
python3 -m venv "$DIR/.venv"
"$DIR/.venv/bin/pip" install -q --upgrade pip
"$DIR/.venv/bin/pip" install -q -r "$DIR/requirements.txt"
[ -f "$DIR/.env" ] || cp "$DIR/.env.example" "$DIR/.env"
mkdir -p "$DIR/data"
chown -R "$USER_NAME" "$DIR"

echo "==> Service systemd"
sed -e "s#__DIR__#$DIR#g" -e "s#__USER__#$USER_NAME#g" "$DIR/deploy/maison.service" > /etc/systemd/system/maison.service
systemctl daemon-reload
systemctl enable --now maison.service

IP="$(hostname -I | awk '{print $1}')"
echo
echo "Maison connectée est lancée : http://$IP:8123"
echo "Commandes utiles : systemctl status maison | journalctl -u maison -f | systemctl restart maison"

#!/usr/bin/env bash
# =============================================================================
# LiquidOS — ШАГ 2: Автологин + автозапуск
# Настраивает systemd чтобы при старте системы:
#   1. tty1 автоматически логинился как liquidkiosk (без пароля/prompt)
#   2. liquidkiosk.service запускал cage → chromium --kiosk
# =============================================================================
set -euo pipefail

KIOSK_USER="liquidkiosk"
APP_DIR="/opt/liquidOS"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ── 2.1 Переопределить getty@tty1 для автологина ─────────────────────────────
log "Настройка автологина на tty1..."

mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
# Убираем стандартную команду getty
ExecStart=
# Заменяем на agetty с автологином
ExecStart=-/sbin/agetty \
    --autologin ${KIOSK_USER} \
    --noclear \
    --noissue \
    %I \
    \$TERM
EOF

# ── 2.2 Запустить LiquidOS из .bash_profile ───────────────────────────────────
# (только на tty1, только если это не уже запущенный kiosk)
log "Настройка .bash_profile для автозапуска..."

cat > "/home/${KIOSK_USER}/.bash_profile" << 'PROFILE'
# Запускаем kiosk только на tty1 и только при интерактивном логине
if [[ -z "$DISPLAY" && -z "$WAYLAND_DISPLAY" && "$(tty)" == "/dev/tty1" ]]; then
    exec systemctl --user start liquidOS-kiosk.service
fi
PROFILE

chown "${KIOSK_USER}:${KIOSK_USER}" "/home/${KIOSK_USER}/.bash_profile"

# ── 2.3 Включить lingering (systemd user-сервисы без GUI-сессии) ───────────────
log "Включение systemd lingering для ${KIOSK_USER}..."
loginctl enable-linger "$KIOSK_USER"

# ── 2.4 Установить пользовательский systemd unit ──────────────────────────────
log "Установка systemd user-юнита..."

USER_SYSTEMD="/home/${KIOSK_USER}/.config/systemd/user"
mkdir -p "$USER_SYSTEMD"

# Скопировать unit-файл из нашего проекта:
cp "$(dirname "$0")/../systemd/liquidOS-kiosk.service" \
   "${USER_SYSTEMD}/liquidOS-kiosk.service"

chown -R "${KIOSK_USER}:${KIOSK_USER}" "/home/${KIOSK_USER}/.config"

# Выполнить reload и enable от имени пользователя:
sudo -u "$KIOSK_USER" \
    XDG_RUNTIME_DIR="/run/user/$(id -u $KIOSK_USER)" \
    systemctl --user daemon-reload

sudo -u "$KIOSK_USER" \
    XDG_RUNTIME_DIR="/run/user/$(id -u $KIOSK_USER)" \
    systemctl --user enable liquidOS-kiosk.service

# ── 2.5 Отключить ненужные службы для ускорения загрузки ─────────────────────
log "Отключение лишних служб..."
systemctl disable --now \
    ModemManager.service \
    networkd-dispatcher.service \
    multipathd.service \
    apt-daily.timer \
    apt-daily-upgrade.timer \
    motd-news.timer \
    2>/dev/null || true

# ── 2.6 Настроить NetworkManager для тихого соединения ────────────────────────
if command -v nmcli &>/dev/null; then
    nmcli general logging level ERROR
fi

log "✓ Шаг 2 завершён."
log "  Следующий шаг: перезагрузите систему командой: sudo reboot"
log "  Система должна загрузиться прямо в LiquidOS."

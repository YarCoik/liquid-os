#!/usr/bin/env bash
# =============================================================================
# LiquidOS — ШАГ 1: Подготовка базовой системы Ubuntu Server 24.04
# Запускать от root ПОСЛЕ минимальной установки Ubuntu Server
# (выбрать "Ubuntu Server (minimized)" в инсталляторе)
# =============================================================================
set -euo pipefail

KIOSK_USER="liquidkiosk"
APP_DIR="/opt/liquidOS"
LOG="/var/log/liquidOS-setup.log"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

# ── 1.1 Базовое обновление ────────────────────────────────────────────────────
log "Обновление пакетов..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 1.2 Удалить лишнее (snapd, cloud-init, etc.) ─────────────────────────────
log "Удаление ненужных компонентов..."
apt-get purge -y --auto-remove \
    snapd \
    cloud-init \
    ubuntu-advantage-tools \
    unattended-upgrades \
    apport \
    2>/dev/null || true

# ── 1.3 Установка необходимых пакетов ────────────────────────────────────────
log "Установка пакетов Wayland + Chromium + утилиты..."
apt-get install -y \
    # ── Wayland compositor для kiosk-режима ──
    cage \
    # ── Браузер ──
    chromium-browser \
    # ── Wayland runtime ──
    libwayland-client0 \
    libwayland-server0 \
    libwayland-egl1 \
    # ── GPU / DRM ──
    libdrm2 \
    libgbm1 \
    libegl1 \
    libgl1 \
    # ── Входные устройства (Wayland) ──
    libinput10 \
    libxkbcommon0 \
    # ── Шрифты (нужны нашему UI) ──
    fonts-open-sans \
    fontconfig \
    # ── Инструменты ──
    curl \
    git \
    xdg-user-dirs \
    dbus \
    dbus-user-session \
    2>/dev/null

# ── 1.4 Создать пользователя-киоска ──────────────────────────────────────────
log "Создание пользователя ${KIOSK_USER}..."
if ! id "$KIOSK_USER" &>/dev/null; then
    useradd \
        --create-home \
        --shell /bin/bash \
        --comment "LiquidOS Kiosk" \
        --groups video,input,render,audio \
        "$KIOSK_USER"
fi

# ── 1.5 Скопировать файлы LiquidOS ───────────────────────────────────────────
log "Развёртывание файлов приложения в ${APP_DIR}..."
mkdir -p "$APP_DIR"

# Если файлы рядом со скриптом:
if [ -d "$(dirname "$0")/app" ]; then
    cp -r "$(dirname "$0")/app/"* "$APP_DIR/"
else
    log "ПРЕДУПРЕЖДЕНИЕ: папка app/ не найдена — скопируйте вручную:"
    log "  cp index.html style.css script.js ${APP_DIR}/"
fi

chown -R "$KIOSK_USER:$KIOSK_USER" "$APP_DIR"
chmod -R 755 "$APP_DIR"

log "✓ Шаг 1 завершён. Продолжайте: sudo bash step2_autostart.sh"

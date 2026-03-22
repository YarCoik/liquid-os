#!/usr/bin/env bash
# =============================================================================
# LiquidOS — Альтернативная сборка на базе Arch Linux
# Запускать ПОСЛЕ arch-chroot в установленную систему
# (предполагается что базовая установка через archinstall или вручную уже сделана)
# =============================================================================
set -euo pipefail

KIOSK_USER="liquidkiosk"

log() { echo -e "\033[0;36m[ARCH]\033[0m $*"; }

# ── Обновление и установка пакетов ───────────────────────────────────────────
log "Установка пакетов из официального репо..."
pacman -Syu --noconfirm

pacman -S --noconfirm \
    # ── Wayland стек ──
    wayland \
    cage \
    # ── Chromium ──
    chromium \
    # ── GPU ──
    mesa \
    libva \
    libva-mesa-driver \
    # ── Шрифты ──
    ttf-liberation \
    noto-fonts \
    fontconfig \
    # ── Входные устройства ──
    libinput \
    xkeyboard-config \
    # ── DBus ──
    dbus \
    # ── Утилиты ──
    curl \
    git \
    sudo

# ── Пользователь ─────────────────────────────────────────────────────────────
log "Создание пользователя ${KIOSK_USER}..."
useradd -m -G video,input,render,audio -s /bin/bash "$KIOSK_USER"

# ── Структура каталогов ───────────────────────────────────────────────────────
mkdir -p /opt/liquidOS
chown "$KIOSK_USER:$KIOSK_USER" /opt/liquidOS

log "На Arch Linux дальнейшие шаги (step2_autostart.sh) идентичны Ubuntu."
log "Единственное отличие: Chromium называется 'chromium', не 'chromium-browser'."
log "Замените в liquidOS-kiosk.service путь:"
log "  /usr/bin/chromium-browser  →  /usr/bin/chromium"

#!/usr/bin/env bash
# =============================================================================
# watchdog.sh — перезапускает kiosk если он не работает
# =============================================================================
KIOSK_USER="liquidkiosk"
CHECK_INTERVAL=15   # секунд между проверками
MAX_MEM_MB=1800     # перезапуск если Chromium съел больше N MB RAM

while true; do
    sleep "$CHECK_INTERVAL"

    # Проверка: жив ли сервис?
    if ! sudo -u "$KIOSK_USER" \
            XDG_RUNTIME_DIR="/run/user/$(id -u $KIOSK_USER)" \
            systemctl --user is-active --quiet liquidOS-kiosk.service; then

        logger -t liquidOS-watchdog "Kiosk service is down, restarting..."
        sudo -u "$KIOSK_USER" \
            XDG_RUNTIME_DIR="/run/user/$(id -u $KIOSK_USER)" \
            systemctl --user restart liquidOS-kiosk.service
        continue
    fi

    # Проверка: не съел ли Chromium слишком много памяти?
    CHROMIUM_PID=$(pgrep -u "$KIOSK_USER" -x chromium-browser | head -1)
    if [[ -n "$CHROMIUM_PID" ]]; then
        MEM_KB=$(awk '/VmRSS/{print $2}' /proc/"$CHROMIUM_PID"/status 2>/dev/null || echo 0)
        MEM_MB=$(( MEM_KB / 1024 ))

        if (( MEM_MB > MAX_MEM_MB )); then
            logger -t liquidOS-watchdog \
                "Chromium RAM usage ${MEM_MB}MB > ${MAX_MEM_MB}MB, restarting..."
            sudo -u "$KIOSK_USER" \
                XDG_RUNTIME_DIR="/run/user/$(id -u $KIOSK_USER)" \
                systemctl --user restart liquidOS-kiosk.service
        fi
    fi
done

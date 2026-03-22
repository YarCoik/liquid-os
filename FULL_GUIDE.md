# LiquidOS Linux — Пошаговый гайд «от нуля до экрана»

## ──────────────────────────────────────────────────────────────────
## ШАГ 0 — Что понадобится
## ──────────────────────────────────────────────────────────────────

Нужно:
- USB-флешка ≥ 8 GB
- ISO: Ubuntu Server 24.04 LTS (minimal)
  Скачать: https://releases.ubuntu.com/24.04/ubuntu-24.04-live-server-amd64.iso
- Утилита записи: Rufus (Windows), Balena Etcher (Mac/Linux), или:
    dd if=ubuntu-24.04-live-server-amd64.iso of=/dev/sdX bs=4M status=progress

Файлы этого проекта (liquidOS-distro/) скопируй на флешку или
в домашнюю папку после установки.

## ──────────────────────────────────────────────────────────────────
## ШАГ 1 — Установка Ubuntu Server
## ──────────────────────────────────────────────────────────────────

Загрузись с флешки. В установщике:

1.  Language: English (или Russian)
2.  Keyboard: выбери свою раскладку
3.  Type of install: **Ubuntu Server (minimized)**  ← важно!
4.  Network: настрой если нужен интернет для apt
5.  Storage: Guided - entire disk (или вручную)
6.  Profile:
      Your name:        LiquidOS
      Server's name:    liquidbox
      Username:         admin           ← это технический sudo-аккаунт
      Password:         (что угодно)
7.  SSH: НЕ нужен (можно включить для удалённой настройки)
8.  Featured snaps: НИЧЕГО не выбирать
9.  Install → Reboot

После перезагрузки зайди под admin:

    login: admin
    password: (что ввёл)

## ──────────────────────────────────────────────────────────────────
## ШАГ 2 — Скопировать файлы проекта
## ──────────────────────────────────────────────────────────────────

Если машина с интернетом — самый простой способ:

    # Установить git (если нет)
    sudo apt-get install -y git

    # Клонировать/скачать этот репо или скопировать вручную
    # Структура должна быть такой:
    #   ~/liquidOS-distro/
    #       scripts/
    #       systemd/
    #       configs/
    #   ~/liquidOS-app/          ← ТВОИ index.html, style.css, script.js
    #       index.html
    #       style.css
    #       script.js

    mkdir -p ~/liquidOS-app
    # скопируй сюда свои три файла LiquidOS

Если без интернета — скопируй с флешки:

    sudo mount /dev/sdb1 /mnt
    cp -r /mnt/liquidOS-distro ~/
    cp -r /mnt/liquidOS-app ~/
    sudo umount /mnt

## ──────────────────────────────────────────────────────────────────
## ШАГ 3 — Запустить установочный скрипт
## ──────────────────────────────────────────────────────────────────

    cd ~/liquidOS-distro

    # Скопировать файлы приложения в нужное место
    mkdir -p ~/liquidOS-distro/scripts/app
    cp ~/liquidOS-app/* ~/liquidOS-distro/scripts/app/

    # Запустить шаг 1 (установка пакетов)
    sudo bash scripts/step1_install_packages.sh

    # Запустить шаг 2 (автологин + автозапуск)
    sudo bash scripts/step2_autostart.sh

Что произойдёт:
  - Установится cage (Wayland-compositor для kiosk)
  - Установится chromium-browser
  - Создастся пользователь liquidkiosk
  - Файлы LiquidOS скопируются в /opt/liquidOS/
  - tty1 настроится на автологин
  - systemd user-сервис зарегистрируется

## ──────────────────────────────────────────────────────────────────
## ШАГ 4 — Ускорить GRUB
## ──────────────────────────────────────────────────────────────────

    sudo cp configs/grub /etc/default/grub
    sudo update-grub

Это убирает 5-секундную паузу GRUB и отключает лишние
сообщения при загрузке.

## ──────────────────────────────────────────────────────────────────
## ШАГ 5 — Установить watchdog (опционально, но рекомендуется)
## ──────────────────────────────────────────────────────────────────

    sudo cp systemd/liquidOS-watchdog.service \
             /etc/systemd/system/

    sudo cp scripts/watchdog.sh \
             /opt/liquidOS/scripts/watchdog.sh

    sudo chmod +x /opt/liquidOS/scripts/watchdog.sh

    sudo systemctl daemon-reload
    sudo systemctl enable --now liquidOS-watchdog.service

## ──────────────────────────────────────────────────────────────────
## ШАГ 6 — Перезагрузка
## ──────────────────────────────────────────────────────────────────

    sudo reboot

После загрузки (~8–12 секунд на современном железе) система
должна автоматически открыть LiquidOS на весь экран.

## ──────────────────────────────────────────────────────────────────
## ДИАГНОСТИКА — если что-то не запустилось
## ──────────────────────────────────────────────────────────────────

Нажми Ctrl+Alt+F2 чтобы переключиться на tty2 и войти как admin.

    # Посмотреть статус сервиса
    sudo -u liquidkiosk \
        XDG_RUNTIME_DIR=/run/user/$(id -u liquidkiosk) \
        systemctl --user status liquidOS-kiosk.service

    # Посмотреть логи
    sudo journalctl -u liquidOS-watchdog.service -n 50

    # Запустить вручную для отладки
    sudo -u liquidkiosk bash
    WAYLAND_DISPLAY=wayland-0 \
    XDG_RUNTIME_DIR=/run/user/$(id -u) \
    cage -s -- chromium-browser --kiosk "file:///opt/liquidOS/index.html"

Частые проблемы:

1. "cage: No DRM device found"
   → Нет GPU или не загружен драйвер
   → Решение: sudo apt install linux-firmware mesa-utils

2. Chromium не открывается, сразу закрывается
   → Проблема с GPU acceleration на старом железе
   → Добавить в ExecStart: --disable-gpu --disable-software-rasterizer

3. Файлы не грузятся (белый экран)
   → Проверь права: ls -la /opt/liquidOS/
   → Должно быть: chown liquidkiosk:liquidkiosk

4. Шрифт Outfit не загружается (нет интернета)
   → Скачай и установи локально:
      sudo apt install fonts-open-sans
   → Замени в index.html Google Fonts на system-ui

## ──────────────────────────────────────────────────────────────────
## АЛЬТЕРНАТИВА — Electron вместо Chromium+Cage
## ──────────────────────────────────────────────────────────────────

Если хочешь Electron-обёртку (даёт нативный доступ к Node.js API):

    # На машине сборки (или прямо на целевой)
    cd ~/liquidOS-distro/electron

    # Скопировать app-файлы
    mkdir -p app
    cp ~/liquidOS-app/* app/

    # Установить Node.js
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt install -y nodejs

    # Установить зависимости
    npm install

    # Тест запуска
    npx electron . --kiosk

    # Собрать .deb пакет
    npm run build

    # Установить
    sudo dpkg -i dist/*.deb

Затем замени в liquidOS-kiosk.service строку ExecStart:

    ExecStart=/usr/bin/liquidOS --kiosk

## ──────────────────────────────────────────────────────────────────
## ИТОГОВОЕ ВРЕМЯ ЗАГРУЗКИ (ориентировочно)
## ──────────────────────────────────────────────────────────────────

  BIOS/UEFI:        ~1–3 сек
  GRUB:             0 сек (timeout=0)
  Linux kernel:     ~1–2 сек
  systemd init:     ~2–3 сек
  cage + chromium:  ~3–5 сек
  ─────────────────────────
  ИТОГО:            ~7–13 сек до LiquidOS на экране

Для сравнения: Ubuntu Desktop с GNOME = ~25–40 сек.
ChromeOS на том же железе = ~8–15 сек.

## ──────────────────────────────────────────────────────────────────
## ОБНОВЛЕНИЕ LiquidOS (когда изменил код)
## ──────────────────────────────────────────────────────────────────

    # Скопировать новые файлы
    sudo cp ~/liquidOS-app/* /opt/liquidOS/

    # Перезапустить kiosk (без перезагрузки системы!)
    sudo -u liquidkiosk \
        XDG_RUNTIME_DIR=/run/user/$(id -u liquidkiosk) \
        systemctl --user restart liquidOS-kiosk.service

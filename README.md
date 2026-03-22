# LiquidOS — Kiosk Linux Build Guide

## Архитектура стека

```
Железо (BIOS/UEFI)
  └── GRUB → Linux Kernel
        └── systemd (PID 1)
              └── getty@tty1 → auto-login → liquidOS user
                    └── cage (Wayland compositor, 1 window)
                          └── Chromium --kiosk  ← наш LiquidOS
```

**Почему Cage + Chromium, а не Electron?**
- Cage — минималистичный Wayland-композитор (< 2 000 строк кода),
  разработанный специально для kiosk-режима, запускает ровно одно окно.
- Chromium --kiosk — хорошо протестированный, GPU-ускоренный,
  поддерживает все Web API (AudioContext, Canvas, CSS backdrop-filter).
- Electron добавляет ~80–120 MB к образу и ничего не даёт сверх этого
  для чисто frontend-приложения.

## Варианты базы

| Вариант | + | - |
|---------|---|---|
| Ubuntu Server 24.04 LTS | APT, много документации, долгая поддержка | Больший образ (~800 MB установленного) |
| Arch Linux | Минимум (~200 MB), последние пакеты | Нет LTS, ручная настройка |
| Alpine Linux | Крошечный (~130 MB) | musl libc, сложнее с Chromium |

**Рекомендуется: Ubuntu Server 24.04 minimal** — стабильно, cage и
chromium есть в официальных репо.

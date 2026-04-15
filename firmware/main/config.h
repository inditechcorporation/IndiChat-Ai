#pragma once

// ── Server ────────────────────────────────────────────────────────────
// After deploy, set your Render URL here
// Local test: "http://192.168.x.x:3000"
// Production: "https://indichat-server.onrender.com"
#define SERVER_HOST        "YOUR_RENDER_URL_HERE"
#define SERVER_PORT        443
#define OTA_URL            SERVER_HOST "/ota/"
#define WS_SERVER_URL      SERVER_HOST
#define WS_PORT            443
#define WS_PATH            "/ws"

// ── WiFi Provisioning AP ─────────────────────────────────────────────
#define WIFI_AP_SSID       "IndiChat-Setup"
#define WIFI_AP_PASSWORD   ""
#define WIFI_AP_IP         "192.168.4.1"

// ── INMP441 I2S Microphone ────────────────────────────────────────────
#define MIC_I2S_PORT       I2S_NUM_1
#define MIC_WS_GPIO        25
#define MIC_SCK_GPIO       26
#define MIC_SD_GPIO        32
#define MIC_SAMPLE_RATE    16000
#define MIC_FRAME_MS       60              // 60ms per OPUS frame

// ── MAX98357A I2S Speaker ─────────────────────────────────────────────
#define SPK_I2S_PORT       I2S_NUM_0
#define SPK_BCLK_GPIO      14
#define SPK_LRCK_GPIO      27
#define SPK_DIN_GPIO       33
#define SPK_SAMPLE_RATE    16000

// ── SSD1306 OLED 0.96" ───────────────────────────────────────────────
#define OLED_SDA_GPIO      21
#define OLED_SCL_GPIO      22
#define OLED_I2C_ADDR      0x3C
#define OLED_WIDTH         128
#define OLED_HEIGHT        64

// ── Buttons ───────────────────────────────────────────────────────────
#define BOOT_BTN_GPIO      0    // BOOT button - WiFi config / toggle talk
#define TALK_BTN_GPIO      4    // Leaf switch - push to talk

// ── LED ───────────────────────────────────────────────────────────────
#define LED_GPIO           2    // 5mm Red LED via 220Ω resistor

// ── Slide Switch ──────────────────────────────────────────────────────
#define SLIDE_SW_GPIO      15   // 3-pin slide switch middle pin

// ── Audio OPUS ────────────────────────────────────────────────────────
#define OPUS_BITRATE       32000
#define OPUS_FRAME_SIZE    960  // 16000Hz * 60ms = 960 samples
#define AUDIO_BUF_SIZE     4096

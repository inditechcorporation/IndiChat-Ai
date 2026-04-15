#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include "esp_timer.h"

#include "config.h"
#include "led.h"
#include "button.h"
#include "oled.h"
#include "wifi_prov.h"
#include "ota_client.h"
#include "audio.h"
#include "websocket_client.h"

static const char *TAG = "MAIN";

// ── App state ─────────────────────────────────────────────────────────
typedef enum {
    STATE_STARTING,
    STATE_WIFI_PROV,       // AP mode, waiting for WiFi config
    STATE_CONNECTING,      // Connecting to WiFi
    STATE_ACTIVATING,      // Showing activation code
    STATE_IDLE,            // Ready, waiting for button
    STATE_LISTENING,       // Recording mic
    STATE_THINKING,        // Waiting for AI response
    STATE_SPEAKING,        // Playing TTS audio
} app_state_t;

static volatile app_state_t app_state = STATE_STARTING;
static char ws_url[128] = {0};
static char activation_code[16] = {0};
static esp_timer_handle_t blink_timer = NULL;

// Blink timer callback - every 100ms
static void blink_timer_cb(void *arg) {
    oled_face_blink();
}

// ── State helpers ─────────────────────────────────────────────────────
static void set_state(app_state_t s) {
    app_state = s;
    switch (s) {
        case STATE_WIFI_PROV:
            led_set(LED_BLINK_SLOW);
            break;
        case STATE_CONNECTING:
            led_set(LED_BLINK_FAST);
            oled_show_status("Connecting...", "Please wait");
            break;
        case STATE_ACTIVATING:
            led_set(LED_BLINK_SLOW);
            oled_show_activation_code(activation_code);
            break;
        case STATE_IDLE:
            led_set(LED_OFF);
            oled_face_set_emotion("neutral");
            oled_face_set_caption("IndiChat");
            break;
        case STATE_LISTENING:
            led_set(LED_ON);
            oled_face_set_emotion("surprised");
            oled_face_set_caption("Listening");
            break;
        case STATE_THINKING:
            led_set(LED_BLINK_FAST);
            oled_face_set_emotion("thinking");
            oled_face_set_caption("Thinking");
            break;
        case STATE_SPEAKING:
            led_set(LED_PULSE);
            oled_face_set_emotion("happy");
            break;
        default: break;
    }
}

// ── Audio callbacks ───────────────────────────────────────────────────
static void on_mic_data(const uint8_t *opus, size_t len) {
    // Send OPUS frame to server via WebSocket
    ws_send_audio(opus, len);
}

// ── WebSocket callbacks ───────────────────────────────────────────────
static void on_ws_connected(void) {
    ESP_LOGI(TAG, "WS connected - sending hello");
    ws_send_json("{\"type\":\"hello\",\"version\":3,\"transport\":\"websocket\","
                 "\"audio_params\":{\"format\":\"opus\",\"sample_rate\":16000,"
                 "\"channels\":1,\"frame_duration\":60}}");
    set_state(STATE_IDLE);
}

static void on_ws_disconnected(void) {
    ESP_LOGW(TAG, "WS disconnected");
    if (app_state == STATE_LISTENING) audio_stop_recording();
    audio_stop_playing();
    set_state(STATE_CONNECTING);
    // Reconnect after 3 seconds
    vTaskDelay(pdMS_TO_TICKS(3000));
    ws_connect(ws_url);
}

static void on_ws_audio(const uint8_t *data, size_t len) {
    // OPUS audio from server → play on speaker
    if (app_state != STATE_SPEAKING) set_state(STATE_SPEAKING);
    audio_play_opus(data, len);
}

static void on_ws_text(const char *type, const char *text) {
    ESP_LOGI(TAG, "WS msg: type=%s text=%s", type, text);

    if (strcmp(type, "hello") == 0) {
        // Server hello received
        set_state(STATE_IDLE);

    } else if (strcmp(type, "stt") == 0) {
        // Speech recognized - show on OLED caption
        oled_face_set_caption(text);

    } else if (strcmp(type, "tts") == 0) {
        if (strcmp(text, "start") == 0) {
            set_state(STATE_SPEAKING);
        } else if (strcmp(text, "sentence_start") == 0) {
            // Show caption on face right side
            oled_face_set_caption(text);
        } else if (strcmp(text, "stop") == 0) {
            vTaskDelay(pdMS_TO_TICKS(500));
            set_state(STATE_IDLE);
        }

    } else if (strcmp(type, "llm") == 0) {
        set_state(STATE_THINKING);
        // Show emotion on face
        oled_face_set_emotion(text[0] ? text : "thinking");

    } else if (strcmp(type, "alert") == 0) {
        oled_show_status("Alert", text);
        led_set(LED_BLINK_FAST);
        vTaskDelay(pdMS_TO_TICKS(3000));
        set_state(STATE_IDLE);
    }
}

// ── Button callbacks ──────────────────────────────────────────────────
static void on_boot_click(void) {
    ESP_LOGI(TAG, "BOOT click, state=%d", app_state);

    if (app_state == STATE_IDLE) {
        // Start talking
        set_state(STATE_LISTENING);
        ws_send_listen_start();
        audio_start_recording(on_mic_data);

    } else if (app_state == STATE_LISTENING) {
        // Stop talking
        audio_stop_recording();
        ws_send_listen_stop();
        set_state(STATE_THINKING);

    } else if (app_state == STATE_SPEAKING) {
        // Interrupt
        audio_stop_playing();
        ws_send_abort();
        set_state(STATE_IDLE);

    } else if (app_state == STATE_ACTIVATING) {
        // Skip activation (go idle, will retry on next boot)
        set_state(STATE_IDLE);
    }
}

static void on_boot_long_press(void) {
    ESP_LOGI(TAG, "BOOT long press - factory reset WiFi");
    oled_show_status("Resetting WiFi...", "Restarting");
    vTaskDelay(pdMS_TO_TICKS(1000));
    wifi_prov_erase();
    esp_restart();
}

static void on_talk_down(void) {
    if (app_state != STATE_IDLE) return;
    set_state(STATE_LISTENING);
    ws_send_listen_start();
    audio_start_recording(on_mic_data);
}

static void on_talk_up(void) {
    if (app_state != STATE_LISTENING) return;
    audio_stop_recording();
    ws_send_listen_stop();
    set_state(STATE_THINKING);
}

// ── Activation task ───────────────────────────────────────────────────
static void activation_task(void *arg) {
    ESP_LOGI(TAG, "Activation code: %s", activation_code);
    set_state(STATE_ACTIVATING);

    // Poll server every 3 seconds until activated
    for (int i = 0; i < 100; i++) {
        if (ota_poll_activation()) {
            ESP_LOGI(TAG, "Device activated!");
            oled_show_status("Activated!", "Restarting...");
            vTaskDelay(pdMS_TO_TICKS(2000));
            esp_restart(); // Restart to get WS config
        }
        vTaskDelay(pdMS_TO_TICKS(3000));
    }

    // Timeout - go idle anyway
    set_state(STATE_IDLE);
    vTaskDelete(NULL);
}

// ── WiFi callbacks ────────────────────────────────────────────────────
static void on_wifi_connected(const char *ip) {
    ESP_LOGI(TAG, "WiFi connected: %s", ip);
    set_state(STATE_CONNECTING);

    // Server URL firmware me hardcoded hai (config.h)
    ESP_LOGI(TAG, "Connecting to server: %s", OTA_URL);

    ota_response_t ota = {0};
    int retry = 0;
    while (!ota_check(&ota) && retry++ < 5) {
        oled_show_status("Connecting to", "IndiChat server");
        vTaskDelay(pdMS_TO_TICKS(3000));
    }

    if (ota.needs_activation) {
        strncpy(activation_code, ota.activation_code, sizeof(activation_code) - 1);
        xTaskCreate(activation_task, "act_task", 4096, NULL, 3, NULL);
    } else if (ota.has_ws_config) {
        strncpy(ws_url, ota.ws_url, sizeof(ws_url) - 1);
        ESP_LOGI(TAG, "Connecting WS: %s", ws_url);
        ws_connect(ws_url);
    }
}

static void on_wifi_disconnected(void) {
    set_state(STATE_CONNECTING);
    // Show saved WiFi password + AP info so user can reconnect
    char ssid[64] = {0}, pass[64] = {0};
    nvs_handle_t h;
    if (nvs_open("wifi_cfg", NVS_READONLY, &h) == ESP_OK) {
        size_t len = 64;
        nvs_get_str(h, "ssid", ssid, &len);
        len = 64;
        nvs_get_str(h, "pass", pass, &len);
        nvs_close(h);
    }
    oled_show_wifi_reconnect(ssid, pass,
        wifi_prov_get_ap_ssid(), wifi_prov_get_ap_pass());
}

// ── Main ──────────────────────────────────────────────────────────────
void app_main(void) {
    ESP_LOGI(TAG, "=== Voice Assistant Starting ===");

    // NVS init
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }

    // Hardware init
    led_init();
    oled_init();
    button_init();
    audio_init();
    ws_init();

    // Start face + blink timer
    oled_face_init();
    esp_timer_create_args_t timer_args = {
        .callback = blink_timer_cb,
        .name     = "blink"
    };
    esp_timer_create(&timer_args, &blink_timer);
    esp_timer_start_periodic(blink_timer, 100000); // 100ms

    // Button callbacks
    button_on_boot_click(on_boot_click);
    button_on_boot_long_press(on_boot_long_press);
    button_on_talk_down(on_talk_down);
    button_on_talk_up(on_talk_up);

    // WebSocket callbacks
    ws_on_connected(on_ws_connected);
    ws_on_disconnected(on_ws_disconnected);
    ws_on_audio(on_ws_audio);
    ws_on_text(on_ws_text);

    set_state(STATE_STARTING);
    oled_show_status("Starting...", "Voice Assistant");
    led_set(LED_BLINK_FAST);

    // WiFi init
    wifi_prov_init();
    wifi_prov_on_connected(on_wifi_connected);
    wifi_prov_on_disconnected(on_wifi_disconnected);

    // Check if WiFi credentials saved
    if (wifi_prov_has_credentials()) {
        wifi_prov_connect_saved();
    } else {
        // No WiFi saved - start AP provisioning
        wifi_prov_start_ap();
        set_state(STATE_WIFI_PROV);
    }

    // Main loop - just keep alive
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

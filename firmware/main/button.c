#include "button.h"
#include "config.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"

static const char *TAG = "BTN";

static btn_callback_t boot_click_cb     = NULL;
static btn_callback_t boot_longpress_cb = NULL;
static btn_callback_t talk_down_cb      = NULL;
static btn_callback_t talk_up_cb        = NULL;

static void button_task(void *arg) {
    bool boot_prev = true;   // active low
    bool talk_prev = true;
    uint32_t boot_press_ms = 0;

    while (1) {
        bool boot_now = gpio_get_level(BOOT_BTN_GPIO);
        bool talk_now = gpio_get_level(TALK_BTN_GPIO);

        // ── BOOT button ──────────────────────────────────────────
        if (!boot_now && boot_prev) {
            // pressed
            boot_press_ms = xTaskGetTickCount() * portTICK_PERIOD_MS;
        }
        if (boot_now && !boot_prev) {
            // released
            uint32_t held = (xTaskGetTickCount() * portTICK_PERIOD_MS) - boot_press_ms;
            if (held > 1500) {
                if (boot_longpress_cb) boot_longpress_cb();
            } else {
                if (boot_click_cb) boot_click_cb();
            }
        }

        // ── TALK button (leaf switch) ─────────────────────────────
        if (!talk_now && talk_prev) {
            if (talk_down_cb) talk_down_cb();
        }
        if (talk_now && !talk_prev) {
            if (talk_up_cb) talk_up_cb();
        }

        boot_prev = boot_now;
        talk_prev = talk_now;
        vTaskDelay(pdMS_TO_TICKS(20)); // 20ms debounce
    }
}

void button_init(void) {
    gpio_config_t cfg = {
        .pin_bit_mask = (1ULL << BOOT_BTN_GPIO) | (1ULL << TALK_BTN_GPIO),
        .mode         = GPIO_MODE_INPUT,
        .pull_up_en   = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type    = GPIO_INTR_DISABLE,
    };
    gpio_config(&cfg);
    xTaskCreate(button_task, "btn_task", 2048, NULL, 5, NULL);
    ESP_LOGI(TAG, "Buttons init: BOOT=GPIO%d TALK=GPIO%d", BOOT_BTN_GPIO, TALK_BTN_GPIO);
}

void button_on_boot_click(btn_callback_t cb)      { boot_click_cb     = cb; }
void button_on_boot_long_press(btn_callback_t cb) { boot_longpress_cb = cb; }
void button_on_talk_down(btn_callback_t cb)       { talk_down_cb      = cb; }
void button_on_talk_up(btn_callback_t cb)         { talk_up_cb        = cb; }

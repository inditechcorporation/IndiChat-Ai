#include "led.h"
#include "config.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"

static const char *TAG = "LED";
static led_state_t current_state = LED_OFF;
static TaskHandle_t blink_task = NULL;

static void blink_task_fn(void *arg) {
    while (1) {
        switch (current_state) {
            case LED_BLINK_SLOW:
                gpio_set_level(LED_GPIO, 1);
                vTaskDelay(pdMS_TO_TICKS(500));
                gpio_set_level(LED_GPIO, 0);
                vTaskDelay(pdMS_TO_TICKS(500));
                break;
            case LED_BLINK_FAST:
                gpio_set_level(LED_GPIO, 1);
                vTaskDelay(pdMS_TO_TICKS(100));
                gpio_set_level(LED_GPIO, 0);
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
            default:
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
        }
    }
}

void led_init(void) {
    gpio_config_t cfg = {
        .pin_bit_mask = (1ULL << LED_GPIO),
        .mode         = GPIO_MODE_OUTPUT,
        .pull_up_en   = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type    = GPIO_INTR_DISABLE,
    };
    gpio_config(&cfg);
    gpio_set_level(LED_GPIO, 0);
    xTaskCreate(blink_task_fn, "led_blink", 1024, NULL, 1, &blink_task);
    ESP_LOGI(TAG, "LED init on GPIO %d", LED_GPIO);
}

void led_set(led_state_t state) {
    current_state = state;
    switch (state) {
        case LED_OFF:  gpio_set_level(LED_GPIO, 0); break;
        case LED_ON:   gpio_set_level(LED_GPIO, 1); break;
        default: break; // blink task handles it
    }
}

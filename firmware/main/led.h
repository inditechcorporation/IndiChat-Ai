#pragma once

typedef enum {
    LED_OFF = 0,
    LED_ON,
    LED_BLINK_SLOW,   // 1Hz  - WiFi config mode
    LED_BLINK_FAST,   // 5Hz  - connecting / processing
    LED_PULSE,        // fade - speaking
} led_state_t;

void led_init(void);
void led_set(led_state_t state);

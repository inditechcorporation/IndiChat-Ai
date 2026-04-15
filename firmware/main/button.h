#pragma once
#include <stdbool.h>

typedef void (*btn_callback_t)(void);

void button_init(void);
void button_on_boot_click(btn_callback_t cb);
void button_on_boot_long_press(btn_callback_t cb);
void button_on_talk_down(btn_callback_t cb);
void button_on_talk_up(btn_callback_t cb);

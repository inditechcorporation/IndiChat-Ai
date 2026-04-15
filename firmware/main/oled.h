#pragma once
#include <stdbool.h>

void oled_init(void);
void oled_clear(void);
void oled_print_line(int row, const char *text);
void oled_show_status(const char *line1, const char *line2);
void oled_show_activation_code(const char *code);
void oled_show_ip(const char *ip);
void oled_show_listening(void);
void oled_show_thinking(void);
void oled_show_speaking(const char *text);
void oled_show_idle(const char *bot_name);
void oled_show_emotion(const char *emotion);
void oled_show_ap_info(const char *ssid, const char *password, const char *ip);
void oled_show_wifi_reconnect(const char *home_ssid, const char *home_pass,
                               const char *ap_ssid, const char *ap_pass);

// Animated face
void oled_face_init(void);
void oled_face_set_emotion(const char *emotion);
void oled_face_set_caption(const char *text);
void oled_face_blink(void);

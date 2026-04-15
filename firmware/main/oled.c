#include "oled.h"
#include "config.h"
#include "esp_log.h"
#include "driver/i2c_master.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_panel_vendor.h"
#include <string.h>
#include <stdio.h>

static const char *TAG = "OLED";

// Simple 5x7 font - ASCII 32-127
// Each char = 5 bytes (columns), 7 rows
static const uint8_t font5x7[][5] = {
    {0x00,0x00,0x00,0x00,0x00}, // 32 space
    {0x00,0x00,0x5F,0x00,0x00}, // 33 !
    {0x00,0x07,0x00,0x07,0x00}, // 34 "
    {0x14,0x7F,0x14,0x7F,0x14}, // 35 #
    {0x24,0x2A,0x7F,0x2A,0x12}, // 36 $
    {0x23,0x13,0x08,0x64,0x62}, // 37 %
    {0x36,0x49,0x55,0x22,0x50}, // 38 &
    {0x00,0x05,0x03,0x00,0x00}, // 39 '
    {0x00,0x1C,0x22,0x41,0x00}, // 40 (
    {0x00,0x41,0x22,0x1C,0x00}, // 41 )
    {0x14,0x08,0x3E,0x08,0x14}, // 42 *
    {0x08,0x08,0x3E,0x08,0x08}, // 43 +
    {0x00,0x50,0x30,0x00,0x00}, // 44 ,
    {0x08,0x08,0x08,0x08,0x08}, // 45 -
    {0x00,0x60,0x60,0x00,0x00}, // 46 .
    {0x20,0x10,0x08,0x04,0x02}, // 47 /
    {0x3E,0x51,0x49,0x45,0x3E}, // 48 0
    {0x00,0x42,0x7F,0x40,0x00}, // 49 1
    {0x42,0x61,0x51,0x49,0x46}, // 50 2
    {0x21,0x41,0x45,0x4B,0x31}, // 51 3
    {0x18,0x14,0x12,0x7F,0x10}, // 52 4
    {0x27,0x45,0x45,0x45,0x39}, // 53 5
    {0x3C,0x4A,0x49,0x49,0x30}, // 54 6
    {0x01,0x71,0x09,0x05,0x03}, // 55 7
    {0x36,0x49,0x49,0x49,0x36}, // 56 8
    {0x06,0x49,0x49,0x29,0x1E}, // 57 9
    {0x00,0x36,0x36,0x00,0x00}, // 58 :
    {0x00,0x56,0x36,0x00,0x00}, // 59 ;
    {0x08,0x14,0x22,0x41,0x00}, // 60 <
    {0x14,0x14,0x14,0x14,0x14}, // 61 =
    {0x00,0x41,0x22,0x14,0x08}, // 62 >
    {0x02,0x01,0x51,0x09,0x06}, // 63 ?
    {0x32,0x49,0x79,0x41,0x3E}, // 64 @
    {0x7E,0x11,0x11,0x11,0x7E}, // 65 A
    {0x7F,0x49,0x49,0x49,0x36}, // 66 B
    {0x3E,0x41,0x41,0x41,0x22}, // 67 C
    {0x7F,0x41,0x41,0x22,0x1C}, // 68 D
    {0x7F,0x49,0x49,0x49,0x41}, // 69 E
    {0x7F,0x09,0x09,0x09,0x01}, // 70 F
    {0x3E,0x41,0x49,0x49,0x7A}, // 71 G
    {0x7F,0x08,0x08,0x08,0x7F}, // 72 H
    {0x00,0x41,0x7F,0x41,0x00}, // 73 I
    {0x20,0x40,0x41,0x3F,0x01}, // 74 J
    {0x7F,0x08,0x14,0x22,0x41}, // 75 K
    {0x7F,0x40,0x40,0x40,0x40}, // 76 L
    {0x7F,0x02,0x0C,0x02,0x7F}, // 77 M
    {0x7F,0x04,0x08,0x10,0x7F}, // 78 N
    {0x3E,0x41,0x41,0x41,0x3E}, // 79 O
    {0x7F,0x09,0x09,0x09,0x06}, // 80 P
    {0x3E,0x41,0x51,0x21,0x5E}, // 81 Q
    {0x7F,0x09,0x19,0x29,0x46}, // 82 R
    {0x46,0x49,0x49,0x49,0x31}, // 83 S
    {0x01,0x01,0x7F,0x01,0x01}, // 84 T
    {0x3F,0x40,0x40,0x40,0x3F}, // 85 U
    {0x1F,0x20,0x40,0x20,0x1F}, // 86 V
    {0x3F,0x40,0x38,0x40,0x3F}, // 87 W
    {0x63,0x14,0x08,0x14,0x63}, // 88 X
    {0x07,0x08,0x70,0x08,0x07}, // 89 Y
    {0x61,0x51,0x49,0x45,0x43}, // 90 Z
    {0x00,0x7F,0x41,0x41,0x00}, // 91 [
    {0x02,0x04,0x08,0x10,0x20}, // 92 backslash
    {0x00,0x41,0x41,0x7F,0x00}, // 93 ]
    {0x04,0x02,0x01,0x02,0x04}, // 94 ^
    {0x40,0x40,0x40,0x40,0x40}, // 95 _
    {0x00,0x01,0x02,0x04,0x00}, // 96 `
    {0x20,0x54,0x54,0x54,0x78}, // 97 a
    {0x7F,0x48,0x44,0x44,0x38}, // 98 b
    {0x38,0x44,0x44,0x44,0x20}, // 99 c
    {0x38,0x44,0x44,0x48,0x7F}, // 100 d
    {0x38,0x54,0x54,0x54,0x18}, // 101 e
    {0x08,0x7E,0x09,0x01,0x02}, // 102 f
    {0x0C,0x52,0x52,0x52,0x3E}, // 103 g
    {0x7F,0x08,0x04,0x04,0x78}, // 104 h
    {0x00,0x44,0x7D,0x40,0x00}, // 105 i
    {0x20,0x40,0x44,0x3D,0x00}, // 106 j
    {0x7F,0x10,0x28,0x44,0x00}, // 107 k
    {0x00,0x41,0x7F,0x40,0x00}, // 108 l
    {0x7C,0x04,0x18,0x04,0x78}, // 109 m
    {0x7C,0x08,0x04,0x04,0x78}, // 110 n
    {0x38,0x44,0x44,0x44,0x38}, // 111 o
    {0x7C,0x14,0x14,0x14,0x08}, // 112 p
    {0x08,0x14,0x14,0x18,0x7C}, // 113 q
    {0x7C,0x08,0x04,0x04,0x08}, // 114 r
    {0x48,0x54,0x54,0x54,0x20}, // 115 s
    {0x04,0x3F,0x44,0x40,0x20}, // 116 t
    {0x3C,0x40,0x40,0x20,0x7C}, // 117 u
    {0x1C,0x20,0x40,0x20,0x1C}, // 118 v
    {0x3C,0x40,0x30,0x40,0x3C}, // 119 w
    {0x44,0x28,0x10,0x28,0x44}, // 120 x
    {0x0C,0x50,0x50,0x50,0x3C}, // 121 y
    {0x44,0x64,0x54,0x4C,0x44}, // 122 z
};

// Framebuffer: 128x64 = 1024 bytes (1 bit per pixel, 8 rows of 8px each)
static uint8_t fb[OLED_WIDTH * (OLED_HEIGHT / 8)];

static esp_lcd_panel_io_handle_t io_handle = NULL;
static esp_lcd_panel_handle_t    panel     = NULL;

static void fb_clear(void) {
    memset(fb, 0, sizeof(fb));
}

static void fb_draw_char(int x, int y_page, char c) {
    if (c < 32 || c > 122) c = ' ';
    const uint8_t *glyph = font5x7[c - 32];
    for (int col = 0; col < 5; col++) {
        if (x + col >= OLED_WIDTH) break;
        fb[y_page * OLED_WIDTH + x + col] = glyph[col];
    }
}

static void fb_draw_string(int x, int page, const char *str) {
    while (*str && x < OLED_WIDTH) {
        fb_draw_char(x, page, *str++);
        x += 6; // 5px char + 1px gap
    }
}

static void fb_flush(void) {
    // Send framebuffer to SSD1306
    esp_lcd_panel_draw_bitmap(panel, 0, 0, OLED_WIDTH, OLED_HEIGHT, fb);
}

void oled_init(void) {
    // I2C bus
    i2c_master_bus_config_t bus_cfg = {
        .i2c_port          = I2C_NUM_0,
        .sda_io_num        = OLED_SDA_GPIO,
        .scl_io_num        = OLED_SCL_GPIO,
        .clk_source        = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    i2c_master_bus_handle_t bus;
    ESP_ERROR_CHECK(i2c_new_master_bus(&bus_cfg, &bus));

    // Panel IO
    esp_lcd_panel_io_i2c_config_t io_cfg = {
        .dev_addr            = OLED_I2C_ADDR,
        .control_phase_bytes = 1,
        .dc_bit_offset       = 6,
        .lcd_cmd_bits        = 8,
        .lcd_param_bits      = 8,
        .scl_speed_hz        = 400000,
    };
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_i2c_v2(bus, &io_cfg, &io_handle));

    // SSD1306 panel
    esp_lcd_panel_dev_config_t panel_cfg = {
        .reset_gpio_num  = -1,
        .bits_per_pixel  = 1,
    };
    esp_lcd_panel_ssd1306_config_t ssd_cfg = { .height = OLED_HEIGHT };
    panel_cfg.vendor_config = &ssd_cfg;
    ESP_ERROR_CHECK(esp_lcd_new_panel_ssd1306(io_handle, &panel_cfg, &panel));
    ESP_ERROR_CHECK(esp_lcd_panel_reset(panel));
    ESP_ERROR_CHECK(esp_lcd_panel_init(panel));
    ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel, true));

    fb_clear();
    fb_flush();
    ESP_LOGI(TAG, "OLED SSD1306 128x64 init OK");
}

void oled_clear(void) {
    fb_clear();
    fb_flush();
}

void oled_print_line(int row, const char *text) {
    // Clear that row first
    memset(&fb[row * OLED_WIDTH], 0, OLED_WIDTH);
    fb_draw_string(0, row, text);
    fb_flush();
}

void oled_show_status(const char *line1, const char *line2) {
    fb_clear();
    fb_draw_string(0, 0, line1);
    if (line2) fb_draw_string(0, 2, line2);
    fb_flush();
}

void oled_show_activation_code(const char *code) {
    fb_clear();
    fb_draw_string(0, 0, "Activation Code:");
    fb_draw_string(0, 1, "----------------");
    // Draw code big - center it
    int x = (OLED_WIDTH - strlen(code) * 12) / 2;
    if (x < 0) x = 0;
    // Draw each digit 2x size
    for (int i = 0; code[i]; i++) {
        fb_draw_char(x + i * 12, 3, code[i]);
        fb_draw_char(x + i * 12, 4, code[i]);
    }
    fb_draw_string(0, 6, "Enter on web app");
    fb_flush();
}

void oled_show_ip(const char *ip) {
    fb_clear();
    fb_draw_string(0, 0, "IndiChat Setup");
    fb_draw_string(0, 1, "Connect to:");
    fb_draw_string(0, 2, "IndiChat-Setup");
    fb_draw_string(0, 4, "Then open:");
    fb_draw_string(0, 5, ip);
    fb_flush();
}

void oled_show_listening(void) {
    fb_clear();
    fb_draw_string(20, 2, "Listening...");
    fb_draw_string(10, 4, "[ =========== ]");
    fb_flush();
}

void oled_show_thinking(void) {
    fb_clear();
    fb_draw_string(25, 2, "Thinking...");
    fb_draw_string(20, 4, "* * * * * *");
    fb_flush();
}

void oled_show_speaking(const char *text) {
    fb_clear();
    // Top row: emotion symbol based on text content
    fb_draw_string(0, 0, "Speaking:");
    // Word wrap at 21 chars per line
    char buf[22];
    int len = strlen(text);
    int row = 1;
    for (int i = 0; i < len && row < 7; i += 21) {
        strncpy(buf, text + i, 21);
        buf[21] = '\0';
        fb_draw_string(0, row++, buf);
    }
    fb_flush();
}

void oled_show_emotion(const char *emotion) {
    // Show emotion symbol on top-right corner
    const char *symbol = ":-|";
    if (strcmp(emotion, "happy")    == 0) symbol = ":)  ";
    else if (strcmp(emotion, "sad") == 0) symbol = ":(  ";
    else if (strcmp(emotion, "thinking") == 0) symbol = "... ";
    else if (strcmp(emotion, "excited")  == 0) symbol = ":D  ";
    else if (strcmp(emotion, "angry")    == 0) symbol = ">:( ";
    else if (strcmp(emotion, "surprised")== 0) symbol = ":O  ";
    // Draw emotion on top-right of current display
    fb_draw_string(100, 0, symbol);
    fb_flush();
}

void oled_show_idle(const char *bot_name) {
    fb_clear();
    fb_draw_string(0, 0, bot_name ? bot_name : "Voice Assistant");
    fb_draw_string(0, 2, "Press BOOT or");
    fb_draw_string(0, 3, "hold TALK btn");
    fb_draw_string(0, 5, "to start talking");
    fb_flush();
}

// ═══════════════════════════════════════════════════════════════════
//  ANIMATED FACE - Round circle with eyes + mouth on left 62x62 area
//  Right side (64-127) shows caption text
//
//  Layout (128x64 OLED):
//  ┌──────────────┬──────────────┐
//  │              │  caption     │
//  │   ( ^  ^ )   │  text here   │
//  │   (  ▲  )    │  word wrap   │
//  │   ( ╰──╯ )   │              │
//  │              │              │
//  └──────────────┴──────────────┘
// ═══════════════════════════════════════════════════════════════════

// Face center and radius (left half of 128px display)
#define FACE_CX     31   // center x (left half = 0..63)
#define FACE_CY     31   // center y
#define FACE_R      29   // outer circle radius

// Eye positions (relative to face center)
#define EYE_L_X    (FACE_CX - 10)
#define EYE_R_X    (FACE_CX + 10)
#define EYE_Y      (FACE_CY - 8)
#define EYE_R_SIZE  4    // eye circle radius

// Mouth
#define MOUTH_Y    (FACE_CY + 10)
#define MOUTH_W    14   // half-width of mouth arc

// State
static char  face_emotion[16] = "neutral";
static char  face_caption[128] = "";
static bool  face_eyes_open = true;
static int   face_blink_counter = 0;

// ── Pixel drawing helpers ────────────────────────────────────────────
static void fb_set_pixel(int x, int y, bool on) {
    if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return;
    int page = y / 8;
    int bit  = y % 8;
    if (on)
        fb[page * OLED_WIDTH + x] |=  (1 << bit);
    else
        fb[page * OLED_WIDTH + x] &= ~(1 << bit);
}

// Bresenham circle
static void fb_draw_circle(int cx, int cy, int r, bool on) {
    int x = 0, y = r, d = 3 - 2 * r;
    while (y >= x) {
        fb_set_pixel(cx+x, cy+y, on); fb_set_pixel(cx-x, cy+y, on);
        fb_set_pixel(cx+x, cy-y, on); fb_set_pixel(cx-x, cy-y, on);
        fb_set_pixel(cx+y, cy+x, on); fb_set_pixel(cx-y, cy+x, on);
        fb_set_pixel(cx+y, cy-x, on); fb_set_pixel(cx-y, cy-x, on);
        if (d < 0) d += 4*x + 6;
        else { d += 4*(x-y) + 10; y--; }
        x++;
    }
}

// Filled circle
static void fb_fill_circle(int cx, int cy, int r, bool on) {
    for (int dy = -r; dy <= r; dy++)
        for (int dx = -r; dx <= r; dx++)
            if (dx*dx + dy*dy <= r*r)
                fb_set_pixel(cx+dx, cy+dy, on);
}

// Horizontal line
static void fb_hline(int x0, int x1, int y, bool on) {
    for (int x = x0; x <= x1; x++) fb_set_pixel(x, y, on);
}

// ── Draw face based on current emotion ──────────────────────────────
static void face_draw(void) {
    // Clear left half only (0..63)
    for (int page = 0; page < OLED_HEIGHT/8; page++)
        memset(&fb[page * OLED_WIDTH], 0, 64);

    // ── Outer circle ─────────────────────────────────────────────
    fb_draw_circle(FACE_CX, FACE_CY, FACE_R, true);

    // ── Eyes ─────────────────────────────────────────────────────
    if (face_eyes_open) {
        // Open eyes = filled circles
        fb_fill_circle(EYE_L_X, EYE_Y, EYE_R_SIZE, true);
        fb_fill_circle(EYE_R_X, EYE_Y, EYE_R_SIZE, true);
        // Eye shine (small white dot inside)
        fb_set_pixel(EYE_L_X + 1, EYE_Y - 1, false);
        fb_set_pixel(EYE_R_X + 1, EYE_Y - 1, false);
    } else {
        // Closed eyes = horizontal lines (blink)
        fb_hline(EYE_L_X - EYE_R_SIZE, EYE_L_X + EYE_R_SIZE, EYE_Y, true);
        fb_hline(EYE_L_X - EYE_R_SIZE, EYE_L_X + EYE_R_SIZE, EYE_Y+1, true);
        fb_hline(EYE_R_X - EYE_R_SIZE, EYE_R_X + EYE_R_SIZE, EYE_Y, true);
        fb_hline(EYE_R_X - EYE_R_SIZE, EYE_R_X + EYE_R_SIZE, EYE_Y+1, true);
    }

    // ── Mouth based on emotion ────────────────────────────────────
    if (strcmp(face_emotion, "happy") == 0 ||
        strcmp(face_emotion, "excited") == 0) {
        // Big smile arc (draw arc points)
        for (int dx = -MOUTH_W; dx <= MOUTH_W; dx++) {
            int dy = (dx * dx) / (MOUTH_W + 2);  // parabola = smile
            fb_set_pixel(FACE_CX + dx, MOUTH_Y + dy, true);
            fb_set_pixel(FACE_CX + dx, MOUTH_Y + dy + 1, true);
        }
        // Teeth line for excited
        if (strcmp(face_emotion, "excited") == 0)
            fb_hline(FACE_CX - MOUTH_W/2, FACE_CX + MOUTH_W/2, MOUTH_Y + 2, true);

    } else if (strcmp(face_emotion, "sad") == 0) {
        // Frown arc (inverted smile)
        for (int dx = -MOUTH_W; dx <= MOUTH_W; dx++) {
            int dy = -(dx * dx) / (MOUTH_W + 2);
            fb_set_pixel(FACE_CX + dx, MOUTH_Y + 4 + dy, true);
            fb_set_pixel(FACE_CX + dx, MOUTH_Y + 5 + dy, true);
        }

    } else if (strcmp(face_emotion, "thinking") == 0) {
        // Slight smirk (only right side up)
        for (int dx = 0; dx <= MOUTH_W; dx++) {
            int dy = (dx * dx) / (MOUTH_W * 2);
            fb_set_pixel(FACE_CX + dx, MOUTH_Y + dy, true);
        }
        fb_hline(FACE_CX - MOUTH_W, FACE_CX, MOUTH_Y + 2, true);

    } else if (strcmp(face_emotion, "angry") == 0) {
        // Straight line mouth + angry eyebrows
        fb_hline(FACE_CX - MOUTH_W, FACE_CX + MOUTH_W, MOUTH_Y + 2, true);
        fb_hline(FACE_CX - MOUTH_W, FACE_CX + MOUTH_W, MOUTH_Y + 3, true);
        // Angry eyebrows (diagonal lines above eyes)
        for (int i = 0; i < 6; i++) {
            fb_set_pixel(EYE_L_X - 4 + i, EYE_Y - 6 + i/2, true);
            fb_set_pixel(EYE_R_X + 4 - i, EYE_Y - 6 + i/2, true);
        }

    } else if (strcmp(face_emotion, "surprised") == 0) {
        // Open mouth (small circle)
        fb_draw_circle(FACE_CX, MOUTH_Y + 3, 4, true);

    } else {
        // Neutral - straight line
        fb_hline(FACE_CX - MOUTH_W, FACE_CX + MOUTH_W, MOUTH_Y + 2, true);
    }

    // ── Caption on right half (x=66..127) ────────────────────────
    if (face_caption[0]) {
        char buf[22];
        int len = strlen(face_caption);
        int row = 0;
        for (int i = 0; i < len && row < 8; i += 10) {
            strncpy(buf, face_caption + i, 10);
            buf[10] = '\0';
            // Draw at x=66 (right half)
            const char *p = buf;
            int x = 66;
            while (*p && x < OLED_WIDTH) {
                fb_draw_char(x, row, *p++);
                x += 6;
            }
            row++;
        }
    }

    fb_flush();
}

// ── Public API ───────────────────────────────────────────────────────
void oled_face_init(void) {
    strncpy(face_emotion, "neutral", sizeof(face_emotion)-1);
    face_caption[0] = '\0';
    face_eyes_open  = true;
    face_blink_counter = 0;
    face_draw();
}

void oled_face_set_emotion(const char *emotion) {
    if (!emotion) return;
    strncpy(face_emotion, emotion, sizeof(face_emotion)-1);
    face_draw();
}

void oled_face_set_caption(const char *text) {
    if (!text) { face_caption[0] = '\0'; }
    else {
        // Strip non-ASCII
        int j = 0;
        for (int i = 0; text[i] && j < 120; i++)
            if ((unsigned char)text[i] >= 32 && (unsigned char)text[i] < 127)
                face_caption[j++] = text[i];
        face_caption[j] = '\0';
    }
    face_draw();
}

void oled_face_blink(void) {
    // Call this every 100ms from a timer
    // Blink pattern: open for ~30 ticks, closed for 2 ticks
    face_blink_counter++;
    if (face_blink_counter >= 30) {
        face_eyes_open = false;
        face_draw();
    }
    if (face_blink_counter >= 32) {
        face_eyes_open = true;
        face_blink_counter = 0;
        face_draw();
    }
}

// ── Show AP info (SSID + Password + IP) ──────────────────────────────
void oled_show_ap_info(const char *ssid, const char *password, const char *ip) {
    fb_clear();
    fb_draw_string(0, 0, "IndiChat Setup");
    fb_draw_string(0, 1, "WiFi: Connect to");
    // Truncate SSID if too long
    char buf[22];
    strncpy(buf, ssid, 21); buf[21] = '\0';
    fb_draw_string(0, 2, buf);
    fb_draw_string(0, 3, "Pass:");
    strncpy(buf, password, 21); buf[21] = '\0';
    fb_draw_string(30, 3, buf);
    fb_draw_string(0, 5, "Then open:");
    fb_draw_string(0, 6, ip);
    fb_flush();
}

// ── Show reconnect info when WiFi fails ──────────────────────────────
// Shows saved WiFi password + ESP AP info so user can reconnect
void oled_show_wifi_reconnect(const char *home_ssid, const char *home_pass,
                               const char *ap_ssid, const char *ap_pass) {
    fb_clear();
    fb_draw_string(0, 0, "WiFi Lost!");
    fb_draw_string(0, 1, "Home WiFi pass:");
    char buf[22];
    strncpy(buf, home_pass, 21); buf[21] = '\0';
    fb_draw_string(0, 2, buf);
    fb_draw_string(0, 3, "Reconnect via:");
    strncpy(buf, ap_ssid, 21); buf[21] = '\0';
    fb_draw_string(0, 4, buf);
    fb_draw_string(0, 5, "AP Pass:");
    strncpy(buf, ap_pass, 21); buf[21] = '\0';
    fb_draw_string(48, 5, buf);
    fb_flush();
}

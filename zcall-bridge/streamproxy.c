/*
 * streamproxy.c — LD_PRELOAD shim that redirects the screen-capture reads of
 * a wine app (ZaloCall) from its real X display to the bridge display (:99),
 * where the Wayland screen is rendered by the screen bridge.
 *
 * ZaloCall runs natively on the real display (its call UI is a normal
 * window), but when it captures the screen for "share screen" it reads the
 * root window — which is black/unsupported on rootless XWayland. This shim
 * intercepts the three capture APIs (libX11 XGetImage, XShmGetImage, xcb
 * xcb_get_image) and, for root grabs, serves the same region from the
 * bridge display instead. Everything else passes through untouched.
 *
 * The shim is inert when the bridge display is not reachable, so it can be
 * preloaded unconditionally. When a capture happens and the bridge display
 * is down, it touches ZCALL_PROXY_REQUEST — the plugin watches that file
 * and starts the bridge (popping the compositor's permission dialog), so
 * the user never has to prepare the bridge manually.
 *
 * Frames are read from the bridge display through MIT-SHM (one shared
 * segment, reused while the grab size stays the same), so a 1080p grab no
 * longer streams 8MB through the X socket every frame. Displays without
 * MIT-SHM (or where attaching fails) fall back to plain XGetImage.
 *
 * Build (32-bit — ZaloCall is 32-bit, a 64-bit shim never intercepts):
 *   gcc -m32 -shared -fPIC -O2 streamproxy.c -ldl -lpthread -lX11 -lXext -lxcb -o streamproxy.so
 * Debug: set ZCALL_PROXY_LOG=<file> to log connection changes and a
 * grab-rate line (fps, ms per grab) every few seconds while sharing.
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <pthread.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <time.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/extensions/XShm.h>
#include <xcb/xcb.h>
#include <xcb/xproto.h>

/* Logging is opt-in and must stay off the per-frame path: the plugin always
 * sets ZCALL_PROXY_LOG, and an fprintf+fflush per grab cost as much as the
 * grab itself. Per-frame events are summarised by grab_stats() instead. */
static FILE *logf = NULL;
static int log_state = -1; /* -1 unchecked, 0 off, 1 on */

static void plog(const char *fmt, ...) {
    if (log_state < 0) {
        const char *p = getenv("ZCALL_PROXY_LOG");
        logf = p ? fopen(p, "a") : NULL;
        log_state = logf != NULL;
    }
    if (!log_state) return;
    va_list ap;
    va_start(ap, fmt);
    vfprintf(logf, fmt, ap);
    va_end(ap);
    fflush(logf);
}

static double mono_now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec / 1e9;
}

/* Grab-rate summary every STATS_PERIOD seconds, so the log shows the real
 * share frame rate without a line per frame. */
#define STATS_PERIOD 5.0
static double stats_start = 0;
static unsigned stats_grabs = 0;
static double stats_busy = 0;

static void grab_stats(double t0, const char *api, unsigned w, unsigned h,
                       int shm) {
    double t1 = mono_now();
    if (stats_grabs == 0 && stats_start == 0) {
        plog("streamproxy: first %s root grab %ux%u proxied (%s)\n", api, w,
             h, shm ? "shm" : "XGetImage");
        stats_start = t0;
    }
    stats_grabs++;
    stats_busy += t1 - t0;
    if (t1 - stats_start >= STATS_PERIOD) {
        plog("streamproxy: %.1f fps, %.2f ms/grab, %ux%u via %s\n",
             stats_grabs / (t1 - stats_start), stats_busy * 1000 / stats_grabs,
             w, h, shm ? "shm" : "XGetImage");
        stats_start = t1;
        stats_grabs = 0;
        stats_busy = 0;
    }
}

/* ------------------------------------------------------------------ */
/* lazy connection to the bridge display                               */
/* ------------------------------------------------------------------ */

/* Capture calls can come from several wine threads; every use of the
 * bridge connection and the shared segment goes through this lock. */
static pthread_mutex_t src_lock = PTHREAD_MUTEX_INITIALIZER;

static Display *src_dpy = NULL;

/* A failed connect is not retried for RECONNECT_DELAY seconds: without
 * this, every grab while the bridge is down (and every grab on X11
 * sessions, where there is no bridge) paid for a fresh connect attempt. */
#define RECONNECT_DELAY 1.0
static double next_connect = 0;

typedef XImage *(*XGetImage_fn)(Display *, Drawable, int, int, unsigned int,
                                unsigned int, unsigned long, int);
typedef Bool (*XShmGetImage_fn)(Display *, Drawable, XImage *, int, int,
                                unsigned long);

static XGetImage_fn real_XGetImage = NULL;
static XShmGetImage_fn real_XShmGetImage = NULL;

static void resolve_real(void) {
    if (!real_XGetImage)
        real_XGetImage = (XGetImage_fn)dlsym(RTLD_NEXT, "XGetImage");
    if (!real_XShmGetImage)
        real_XShmGetImage = (XShmGetImage_fn)dlsym(RTLD_NEXT, "XShmGetImage");
}

/* The app starts capturing (user clicked "share screen"): if the bridge
 * display is not up, ask the plugin to start the bridge by touching the
 * request file. The plugin watches it and pops the compositor's
 * permission dialog. */
static void signal_request(void) {
    const char *p = getenv("ZCALL_PROXY_REQUEST");
    if (!p) return;
    FILE *f = fopen(p, "w");
    if (f) fclose(f);
}

/* MIT-SHM segment the bridge display writes grabs into. */
static XImage *shm_img = NULL;
static XShmSegmentInfo shm_info;
static int shm_usable = 1; /* cleared once MIT-SHM is missing or fails */
static int shm_attach_failed = 0;

static void shm_release(void) {
    if (!shm_img) return;
    if (src_dpy) XShmDetach(src_dpy, &shm_info);
    XDestroyImage(shm_img); /* frees the XImage only, not the segment */
    shmdt(shm_info.shmaddr);
    shm_img = NULL;
}

/* If the bridge display dies mid-capture, Xlib's default IO error handler
 * would kill the whole app. Instead drop the cached connection (next grab
 * re-opens or falls through) and chain anything else to the original
 * handler. Runs inside an Xlib call made under src_lock, so no locking. */
static int (*orig_io_handler)(Display *) = NULL;

static int src_io_handler(Display *d) {
    if (d == src_dpy) {
        plog("streamproxy: src connection broken, dropping cache\n");
        src_dpy = NULL;
        shm_release();
        return 0;
    }
    if (orig_io_handler) return orig_io_handler(d);
    return 1;
}

/* Xlib calls exit() once an IO error handler returns, so the handler above
 * alone still killed ZaloCall (and dropped the call) on the first grab after
 * the bridge display went away. libX11 >= 1.7 lets a per-display exit
 * handler replace that exit(); looked up at runtime so older libX11 still
 * loads the shim. */
typedef void (*io_exit_handler_fn)(Display *, void *);
typedef void (*set_io_exit_handler_fn)(Display *, io_exit_handler_fn, void *);

static void src_io_exit_handler(Display *d, void *unused) {
    (void)d;
    (void)unused;
    plog("streamproxy: src display gone, continuing without it\n");
}

static void keep_alive_on_src_loss(Display *d) {
    static set_io_exit_handler_fn set_exit = NULL;
    static int looked_up = 0;
    if (!looked_up) {
        set_exit = (set_io_exit_handler_fn)dlsym(RTLD_DEFAULT, "XSetIOErrorExitHandler");
        looked_up = 1;
        if (!set_exit)
            plog("streamproxy: libX11 has no XSetIOErrorExitHandler; losing the bridge display will end the app\n");
    }
    if (set_exit) set_exit(d, src_io_exit_handler, NULL);
}

/* Caller holds src_lock. */
static Display *ensure_src_dpy(void) {
    if (src_dpy) return src_dpy;
    double now = mono_now();
    if (now < next_connect) return NULL;
    const char *n = getenv("ZCALL_PROXY_SRC");
    if (!n) n = ":99";
    src_dpy = XOpenDisplay(n);
    if (src_dpy) {
        keep_alive_on_src_loss(src_dpy);
        /* Once only: a reopen after a lost bridge must not chain the
         * handler to itself. */
        static int io_handler_set = 0;
        if (!io_handler_set) {
            orig_io_handler = XSetIOErrorHandler(src_io_handler);
            io_handler_set = 1;
        }
        stats_start = 0;
        stats_grabs = 0;
        stats_busy = 0;
        plog("streamproxy: src %s opened\n", n);
    } else {
        next_connect = now + RECONNECT_DELAY;
        plog("streamproxy: cannot open src %s (not proxying)\n", n);
        signal_request();
    }
    return src_dpy;
}

static int shm_error_handler(Display *d, XErrorEvent *e) {
    (void)d;
    (void)e;
    shm_attach_failed = 1;
    return 0;
}

/* (Re)create the shared segment for a w x h grab. Caller holds src_lock. */
static int shm_setup(Display *d, unsigned int w, unsigned int h) {
    shm_release();
    if (!XShmQueryExtension(d)) {
        plog("streamproxy: src has no MIT-SHM, using XGetImage\n");
        shm_usable = 0;
        return 0;
    }
    int scr = DefaultScreen(d);
    XImage *im = XShmCreateImage(d, DefaultVisual(d, scr), DefaultDepth(d, scr),
                                 ZPixmap, NULL, &shm_info, w, h);
    if (!im) goto fail;
    shm_info.shmid = shmget(IPC_PRIVATE, (size_t)im->bytes_per_line * im->height,
                            IPC_CREAT | 0600);
    if (shm_info.shmid < 0) {
        XDestroyImage(im);
        goto fail;
    }
    shm_info.shmaddr = im->data = shmat(shm_info.shmid, NULL, 0);
    shmctl(shm_info.shmid, IPC_RMID, NULL); /* freed once both sides detach */
    if (shm_info.shmaddr == (char *)-1) {
        XDestroyImage(im);
        goto fail;
    }
    shm_info.readOnly = False;
    /* XShmAttach fails asynchronously (e.g. the X server sits in another
     * IPC namespace); catch it here instead of in the app's handler. */
    shm_attach_failed = 0;
    XErrorHandler prev = XSetErrorHandler(shm_error_handler);
    XShmAttach(d, &shm_info);
    XSync(d, False);
    XSetErrorHandler(prev);
    if (shm_attach_failed) {
        XDestroyImage(im);
        shmdt(shm_info.shmaddr);
        goto fail;
    }
    shm_img = im;
    return 1;
fail:
    plog("streamproxy: MIT-SHM setup failed, using XGetImage\n");
    shm_usable = 0;
    return 0;
}

/* Grab a root region of the bridge display. Returns the shared image
 * (*owned = 0, valid until the next grab) or a fresh XGetImage result the
 * caller must XDestroyImage (*owned = 1). Caller holds src_lock. */
static XImage *src_grab(int x, int y, unsigned int w, unsigned int h,
                        unsigned long plane_mask, int format, int *owned) {
    Display *d = src_dpy;
    Window root = DefaultRootWindow(d);
    int scr = DefaultScreen(d);
    /* Out-of-bounds grabs raise BadMatch; let the app's own call fail
     * instead of the app's error handler seeing an error on our display. */
    if (x < 0 || y < 0 || w == 0 || h == 0 ||
        (unsigned int)x + w > (unsigned int)DisplayWidth(d, scr) ||
        (unsigned int)y + h > (unsigned int)DisplayHeight(d, scr))
        return NULL;
    unsigned long all = (1UL << DefaultDepth(d, scr)) - 1;
    if (shm_usable && format == ZPixmap && (plane_mask & all) == all) {
        if ((shm_img && (unsigned int)shm_img->width == w &&
             (unsigned int)shm_img->height == h) ||
            shm_setup(d, w, h)) {
            if (real_XShmGetImage(d, root, shm_img, x, y, AllPlanes)) {
                *owned = 0;
                return shm_img;
            }
            if (!src_dpy) return NULL; /* connection died during the grab */
        }
    }
    *owned = 1;
    return real_XGetImage(d, root, x, y, w, h, plane_mask, format);
}

/* ------------------------------------------------------------------ */
/* libX11: XGetImage / XShmGetImage                                    */
/* ------------------------------------------------------------------ */

static int is_root(Display *dpy, Drawable d) {
    return d == (Drawable)DefaultRootWindow(dpy);
}

XImage *XGetImage(Display *dpy, Drawable d, int x, int y, unsigned int w,
                  unsigned int h, unsigned long plane_mask, int format) {
    resolve_real();
    if (is_root(dpy, d)) {
        XImage *out = NULL;
        pthread_mutex_lock(&src_lock);
        if (ensure_src_dpy() && dpy != src_dpy) {
            double t0 = mono_now();
            int owned = 1;
            XImage *im = src_grab(x, y, w, h, plane_mask, format, &owned);
            if (im && owned) {
                out = im;
            } else if (im) {
                /* hand the app its own copy: it will XDestroyImage it */
                size_t len = (size_t)im->bytes_per_line * im->height;
                char *buf = malloc(len);
                if (buf) {
                    memcpy(buf, im->data, len);
                    out = XCreateImage(src_dpy, DefaultVisual(src_dpy, DefaultScreen(src_dpy)),
                                       im->depth, ZPixmap, 0, buf, w, h,
                                       im->bitmap_pad, im->bytes_per_line);
                    if (!out) free(buf);
                }
            }
            if (out) grab_stats(t0, "XGetImage", w, h, !owned);
        }
        pthread_mutex_unlock(&src_lock);
        if (out) return out;
    }
    return real_XGetImage(dpy, d, x, y, w, h, plane_mask, format);
}

Bool XShmGetImage(Display *dpy, Drawable d, XImage *image, int x, int y,
                  unsigned long plane_mask) {
    resolve_real();
    if (image && is_root(dpy, d)) {
        int done = 0;
        pthread_mutex_lock(&src_lock);
        if (ensure_src_dpy() && dpy != src_dpy) {
            double t0 = mono_now();
            int owned = 1;
            XImage *im = src_grab(x, y, image->width, image->height,
                                  plane_mask, ZPixmap, &owned);
            if (im) {
                size_t copy = im->bytes_per_line < image->bytes_per_line
                                  ? (size_t)im->bytes_per_line
                                  : (size_t)image->bytes_per_line;
                if (im->bytes_per_line == image->bytes_per_line)
                    memcpy(image->data, im->data,
                           copy * (size_t)image->height);
                else
                    for (int r = 0; r < image->height; r++)
                        memcpy(image->data + (size_t)r * image->bytes_per_line,
                               im->data + (size_t)r * im->bytes_per_line, copy);
                if (owned) XDestroyImage(im);
                grab_stats(t0, "XShmGetImage", image->width, image->height,
                           !owned);
                done = 1;
            }
        }
        pthread_mutex_unlock(&src_lock);
        if (done) return True;
    }
    return real_XShmGetImage(dpy, d, image, x, y, plane_mask);
}

/* ------------------------------------------------------------------ */
/* xcb: xcb_get_image / xcb_get_image_reply (Qt QScreen::grabWindow)   */
/* ------------------------------------------------------------------ */

typedef xcb_get_image_cookie_t (*xcb_get_image_fn)(xcb_connection_t *, uint8_t,
                                                   xcb_drawable_t, int16_t,
                                                   int16_t, uint16_t, uint16_t,
                                                   uint32_t);
typedef xcb_get_image_reply_t *(*xcb_get_image_reply_fn)(
    xcb_connection_t *, xcb_get_image_cookie_t, xcb_generic_error_t **);

static xcb_get_image_fn real_xcb_get_image = NULL;
static xcb_get_image_reply_fn real_xcb_get_image_reply = NULL;

#define PROXY_MAP_SIZE 64
static struct {
    uint64_t seq;
    int valid;
    int16_t x, y;
    uint16_t w, h;
} proxy_map[PROXY_MAP_SIZE];

static xcb_window_t conn_root(xcb_connection_t *c) {
    xcb_screen_iterator_t it = xcb_setup_roots_iterator(xcb_get_setup(c));
    return it.rem ? it.data->root : 0;
}

xcb_get_image_cookie_t xcb_get_image(xcb_connection_t *c, uint8_t format,
                                     xcb_drawable_t drawable, int16_t x,
                                     int16_t y, uint16_t width, uint16_t height,
                                     uint32_t plane_mask) {
    if (!real_xcb_get_image)
        real_xcb_get_image = (xcb_get_image_fn)dlsym(RTLD_NEXT, "xcb_get_image");
    int proxy = 0;
    if (format == XCB_IMAGE_FORMAT_Z_PIXMAP && drawable == conn_root(c)) {
        pthread_mutex_lock(&src_lock);
        proxy = ensure_src_dpy() != NULL;
        pthread_mutex_unlock(&src_lock);
    }
    if (!proxy)
        return real_xcb_get_image(c, format, drawable, x, y, width, height,
                                  plane_mask);
    /* The real reply is thrown away (BadMatch on rootless XWayland), so
     * only ask for one pixel of it: the request still has to go out to
     * give the app a valid cookie. */
    xcb_get_image_cookie_t cookie =
        real_xcb_get_image(c, format, drawable, 0, 0, 1, 1, plane_mask);
    pthread_mutex_lock(&src_lock);
    unsigned int slot = cookie.sequence % PROXY_MAP_SIZE;
    for (unsigned int i = 0; i < PROXY_MAP_SIZE; i++) {
        unsigned int s = (slot + i) % PROXY_MAP_SIZE;
        if (!proxy_map[s].valid) {
            proxy_map[s].valid = 1;
            proxy_map[s].seq = cookie.sequence;
            proxy_map[s].x = x;
            proxy_map[s].y = y;
            proxy_map[s].w = width;
            proxy_map[s].h = height;
            break;
        }
    }
    pthread_mutex_unlock(&src_lock);
    return cookie;
}

xcb_get_image_reply_t *xcb_get_image_reply(xcb_connection_t *c,
                                           xcb_get_image_cookie_t cookie,
                                           xcb_generic_error_t **e) {
    if (!real_xcb_get_image_reply)
        real_xcb_get_image_reply =
            (xcb_get_image_reply_fn)dlsym(RTLD_NEXT, "xcb_get_image_reply");
    resolve_real();
    int found = 0;
    int16_t x = 0, y = 0;
    uint16_t w = 0, h = 0;
    pthread_mutex_lock(&src_lock);
    unsigned int slot = cookie.sequence % PROXY_MAP_SIZE;
    for (unsigned int i = 0; i < PROXY_MAP_SIZE; i++) {
        unsigned int s = (slot + i) % PROXY_MAP_SIZE;
        if (proxy_map[s].valid && proxy_map[s].seq == cookie.sequence) {
            proxy_map[s].valid = 0;
            x = proxy_map[s].x;
            y = proxy_map[s].y;
            w = proxy_map[s].w;
            h = proxy_map[s].h;
            found = 1;
            break;
        }
    }
    pthread_mutex_unlock(&src_lock);
    if (!found) return real_xcb_get_image_reply(c, cookie, e);

    /* swallow the real (1x1 / BadMatch) reply */
    xcb_generic_error_t *lerr = NULL;
    free(real_xcb_get_image_reply(c, cookie, &lerr));
    free(lerr);

    xcb_get_image_reply_t *out = NULL;
    pthread_mutex_lock(&src_lock);
    if (ensure_src_dpy()) {
        double t0 = mono_now();
        int owned = 1;
        XImage *im = src_grab(x, y, w, h, AllPlanes, ZPixmap, &owned);
        if (im) {
            size_t len = (size_t)im->bytes_per_line * im->height;
            out = malloc(sizeof(xcb_get_image_reply_t) + len);
            if (out) {
                memset(out, 0, sizeof(xcb_get_image_reply_t));
                out->response_type = 1;
                out->depth = im->depth;
                out->sequence = (uint16_t)cookie.sequence;
                out->visual = XVisualIDFromVisual(
                    DefaultVisual(src_dpy, DefaultScreen(src_dpy)));
                out->length = (uint32_t)(len / 4);
                memcpy(out + 1, im->data, len);
                grab_stats(t0, "xcb_get_image", w, h, !owned);
            }
            if (owned) XDestroyImage(im);
        }
    }
    pthread_mutex_unlock(&src_lock);
    if (!out) plog("streamproxy: xcb src grab failed\n");
    if (!out && e) *e = NULL;
    return out;
}

package com.westchesterguy.chat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import java.util.Locale;

/**
 * The alert sounds built into the app, the same tones as in MW Chat's
 * Settings. Android fixes a notification channel's sound when the channel is
 * made, so each tone gets its own channel; only the chosen one is kept, so
 * the phone's settings show a single "Chat alerts" entry.
 */
final class Tones {
    private static final String PREFS = "mwchat";
    private static final String KEY = "tone";
    private static final String DEFAULT = "bell";
    private static final String PREFIX = "chat_alerts_";

    /** id, name shown on the phone. Matches TONES in the web app's tones.ts, plus Silent. */
    private static final String[][] ALL = {
        {"bell", "Bell"}, {"chime", "Chime"}, {"xylophone", "Xylophone"}, {"marimba", "Marimba"},
        {"glass", "Glass"}, {"harp", "Harp"}, {"dingdong", "Ding-dong"}, {"triad", "Triad"},
        {"kalimba", "Kalimba"}, {"crystal", "Crystal"}, {"pop", "Soft pop"}, {"carlock", "Car lock"},
        {"siren", "Fire engine"}, {"bark", "Bark"}, {"heymichael", "Hey Michael!"}, {"none", "Silent"},
    };

    private Tones() {}

    static boolean isKnown(String id) {
        return label(id) != null;
    }

    static String label(String id) {
        for (String[] t : ALL) if (t[0].equals(id)) return t[1];
        return null;
    }

    static String current(Context c) {
        String id = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, DEFAULT);
        return isKnown(id) ? id : DEFAULT;
    }

    /** The channel's name. The notification service derives the channel id from it. */
    static String channelName(String id) {
        return "Chat alerts (" + label(id) + ")";
    }

    /** The same rule androidx.browser's TrustedWebActivityService uses (channelNameToId). */
    static String channelId(String name) {
        return name.toLowerCase(Locale.ROOT).replace(' ', '_') + "_channel_id";
    }

    /** Saves the choice and sets up its channel. */
    static void choose(Context c, String id) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, id).apply();
        prepare(c);
    }

    /**
     * Makes sure the chosen tone's channel exists, with its sound, and drops the
     * others. Returns the channel's name, for the notification service.
     */
    static String prepare(Context c) {
        String id = current(c);
        String name = channelName(id);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return name;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return name;
        String channelId = channelId(name);
        if (nm.getNotificationChannel(channelId) == null) {
            NotificationChannel ch = new NotificationChannel(channelId, name, NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("New chats and messages from your websites");
            ch.enableVibration(true);
            if ("none".equals(id)) {
                ch.setSound(null, null);
            } else {
                Uri sound = Uri.parse("android.resource://" + c.getPackageName() + "/raw/tone_" + id);
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                ch.setSound(sound, attrs);
            }
            nm.createNotificationChannel(ch);
        }
        for (NotificationChannel ch : nm.getNotificationChannels()) {
            if (!ch.getId().equals(channelId) && ch.getId().startsWith(PREFIX)) {
                nm.deleteNotificationChannel(ch.getId());
            }
        }
        return name;
    }
}

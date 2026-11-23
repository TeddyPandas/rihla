import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return NextResponse.json({ sent: 0, reason: 'push non configuré' });

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const body = await request.json();
    const ziyaraId = String(body.ziyaraId || '');
    const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds.map(String) : [];

    const { data: caller } = await supabase
      .from('group_members').select('id').eq('user_id', user.id).eq('ziyara_id', ziyaraId).eq('role', 'cheikh').maybeSingle();
    if (!caller) return NextResponse.json({ error: 'Action réservée au gestionnaire' }, { status: 403 });

    webpush.setVapidDetails('mailto:contact@rihla.app', pub, priv);
    const admin = createAdminSupabaseClient();
    // Seuls les membres de ce voyage sont ciblés.
    const { data: valid } = await admin.from('group_members').select('id').eq('ziyara_id', ziyaraId).in('id', memberIds);
    const ids = (valid ?? []).map((m) => m.id);
    if (ids.length === 0) return NextResponse.json({ sent: 0 });

    const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('member_id', ids);
    const payload = JSON.stringify({
      title: String(body.title || 'Rappel').slice(0, 80),
      body: String(body.body || '').slice(0, 300),
      url: '/notifications',
    });

    let sent = 0;
    const dead: string[] = [];
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    }));
    if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);
    return NextResponse.json({ sent });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status: 500 });
  }
}

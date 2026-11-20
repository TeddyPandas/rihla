import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { normalizePhoneToE164, e164ToInternalEmail } from '@/lib/auth/phone';
import type { CountryCode } from 'libphonenumber-js';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data: caller } = await supabase
      .from('group_members')
      .select('id, ziyara_id, role')
      .eq('user_id', user.id)
      .eq('role', 'cheikh')
      .limit(1)
      .maybeSingle();

    if (!caller) {
      return NextResponse.json({ error: 'Action réservée au Cheikh' }, { status: 403 });
    }

    const body = await request.json();
    const rawPhone = String(body.phone || '');
    const defaultPassword = String(body.defaultPassword || '');
    const country = (body.country as CountryCode) || 'SN';
    const optionalName = body.fullName ? String(body.fullName).trim() : null;

    const phoneE164 = normalizePhoneToE164(rawPhone, country);
    if (!phoneE164) {
      return NextResponse.json({ error: 'Numéro de téléphone invalide' }, { status: 400 });
    }

    if (defaultPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe provisoire doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    const internalEmail = e164ToInternalEmail(phoneE164);
    const adminClient = createAdminSupabaseClient();

    const { data: createdAuth, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email: internalEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { phone_e164: phoneE164, ziyara_id: caller.ziyara_id },
      });

    if (createUserError || !createdAuth.user) {
      return NextResponse.json(
        { error: createUserError?.message || 'Erreur lors de la création du compte Auth' },
        { status: 400 }
      );
    }

    const { data: newMember, error: insertMemberError } = await adminClient
      .from('group_members')
      .insert({
        ziyara_id: caller.ziyara_id,
        user_id: createdAuth.user.id,
        phone_e164: phoneE164,
        full_name: optionalName,
        role: 'member',
        must_change_password: true,
      })
      .select('id, phone_e164, full_name, must_change_password, created_at')
      .single();

    if (insertMemberError) {
      await adminClient.auth.admin.deleteUser(createdAuth.user.id);
      return NextResponse.json({ error: insertMemberError.message }, { status: 400 });
    }

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

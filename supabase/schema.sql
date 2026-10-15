-- Database dell'RSVP (Supabase, progetto "matrimonio-rsvp").
-- È lo stato applicato al progetto; serve come documentazione e per rifarlo da zero.
--
-- Sicurezza: le tabelle hanno RLS attivo e nessuna policy, quindi dall'esterno non
-- si legge e non si scrive nulla. Si passa solo da due funzioni, che lavorano solo
-- se ricevono la chiave segreta (di cui nel database c'è solo l'impronta SHA-256).
-- Il sito le chiama dalla funzione Vercel con la chiave "publishable", che è solo
-- il lasciapassare di Supabase e non dà nessun permesso sui dati.

create table public.rsvp_risposte (
  id uuid primary key,
  presenza text not null check (presenza in ('si','no')),
  rispondente text not null check (char_length(rispondente) between 2 and 120),
  ospiti jsonb not null default '[]'::jsonb,   -- [{nome, eta: '0-3'|'4-11'|'12+', allergie}]
  versione integer not null default 1,         -- +1 a ogni modifica
  creata timestamptz not null default now(),
  aggiornata timestamptz not null default now()
);

-- Registro di ogni invio (nuova risposta o modifica): nulla va perso.
create table public.rsvp_storico (
  id bigint generated always as identity primary key,
  risposta_id uuid not null,
  evento text not null check (evento in ('nuova','modifica')),
  dati jsonb not null,
  quando timestamptz not null default now()
);

create table public.rsvp_config (
  chiave text primary key,
  valore text not null
);

create index rsvp_storico_quando_idx on public.rsvp_storico(quando desc);

alter table public.rsvp_risposte enable row level security;
alter table public.rsvp_storico enable row level security;
alter table public.rsvp_config enable row level security;
revoke all on public.rsvp_risposte, public.rsvp_storico, public.rsvp_config from anon, authenticated;

-- Impronta della chiave segreta (la chiave in chiaro sta solo in Vercel: RSVP_TOKEN).
-- insert into public.rsvp_config values ('token_sha256', encode(sha256(convert_to('<chiave>','utf8')),'hex'));

create or replace function public.rsvp_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select valore = encode(sha256(convert_to(coalesce(p_token,''),'utf8')),'hex')
       from public.rsvp_config where chiave = 'token_sha256'),
    false);
$$;
revoke all on function public.rsvp_token_ok(text) from public, anon, authenticated;

-- Salva o aggiorna una risposta (stesso p_id = modifica). Restituisce {id, nuova, persone, versione}.
create or replace function public.rsvp_salva(
  p_token text, p_id uuid, p_presenza text, p_rispondente text, p_ospiti jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_nuova boolean;
  v_versione integer;
  v_persone integer := 0;
  v_ospiti jsonb := '[]'::jsonb;
begin
  if not public.rsvp_token_ok(p_token) then
    raise exception 'non autorizzato' using errcode = '28000';
  end if;
  if p_presenza not in ('si','no') then
    raise exception 'presenza non valida';
  end if;
  if p_presenza = 'si' then
    v_persone := coalesce(jsonb_array_length(p_ospiti), 0);
    if v_persone < 1 or v_persone > 10 then
      raise exception 'numero di persone non valido';
    end if;
    v_ospiti := p_ospiti;
  end if;

  insert into public.rsvp_risposte as r (id, presenza, rispondente, ospiti)
  values (v_id, p_presenza, trim(p_rispondente), v_ospiti)
  on conflict (id) do update
    set presenza = excluded.presenza,
        rispondente = excluded.rispondente,
        ospiti = excluded.ospiti,
        versione = r.versione + 1,
        aggiornata = now()
  returning (xmax = 0), r.versione into v_nuova, v_versione;

  insert into public.rsvp_storico (risposta_id, evento, dati)
  values (v_id, case when v_nuova then 'nuova' else 'modifica' end,
          jsonb_build_object('presenza', p_presenza, 'rispondente', trim(p_rispondente),
                             'persone', v_persone, 'versione', v_versione, 'ospiti', v_ospiti));

  return jsonb_build_object('id', v_id, 'nuova', v_nuova, 'persone', v_persone, 'versione', v_versione);
end;
$$;
revoke all on function public.rsvp_salva(text, uuid, text, text, jsonb) from public;
grant execute on function public.rsvp_salva(text, uuid, text, text, jsonb) to anon, authenticated;

-- Il report: totali calcolati sulle righe vere, tutte le risposte, nomi doppi, ultime 20 modifiche.
create or replace function public.rsvp_report(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if not public.rsvp_token_ok(p_token) then
    raise exception 'non autorizzato' using errcode = '28000';
  end if;

  with g as (
    select r.id, o.value as o
      from public.rsvp_risposte r
      cross join lateral jsonb_array_elements(r.ospiti) as o(value)
     where r.presenza = 'si'
  ),
  tot as (
    select
      (select count(*) from public.rsvp_risposte) as risposte,
      (select count(*) from public.rsvp_risposte where presenza = 'si') as risposte_si,
      (select count(*) from public.rsvp_risposte where presenza = 'no') as risposte_no,
      (select count(*) from g) as persone,
      (select count(*) from g where o->>'eta' = '0-3') as fascia_0_3,
      (select count(*) from g where o->>'eta' = '4-11') as fascia_4_11,
      (select count(*) from g where o->>'eta' = '12+') as fascia_12_piu,
      (select count(*) from g where coalesce(o->>'allergie','') <> '') as con_allergie,
      (select max(aggiornata) from public.rsvp_risposte) as ultimo_aggiornamento
  )
  select jsonb_build_object(
    'generato', now(),
    'totali', (select to_jsonb(tot) from tot),
    'risposte', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'presenza', r.presenza, 'rispondente', r.rispondente,
               'persone', jsonb_array_length(r.ospiti), 'versione', r.versione,
               'creata', r.creata, 'aggiornata', r.aggiornata, 'ospiti', r.ospiti)
             order by r.aggiornata desc)
        from public.rsvp_risposte r), '[]'::jsonb),
    'duplicati', coalesce((
      select jsonb_agg(jsonb_build_object('nome', n, 'risposte', c))
        from (select lower(regexp_replace(trim(rispondente), '\s+', ' ', 'g')) as n, count(*) as c
                from public.rsvp_risposte group by 1 having count(*) > 1) d), '[]'::jsonb),
    'storico', coalesce((
      select jsonb_agg(jsonb_build_object(
               'risposta_id', s.risposta_id, 'evento', s.evento, 'quando', s.quando,
               'rispondente', s.dati->>'rispondente', 'presenza', s.dati->>'presenza',
               'persone', (s.dati->>'persone')::int, 'versione', (s.dati->>'versione')::int)
             order by s.quando desc)
        from (select * from public.rsvp_storico order by quando desc limit 20) s), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;
revoke all on function public.rsvp_report(text) from public;
grant execute on function public.rsvp_report(text) to anon, authenticated;

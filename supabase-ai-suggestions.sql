create extension if not exists pgcrypto;

create table if not exists public.student_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  student_code text not null,
  school_code text,
  student_name text,
  risk text not null default 'green' check (risk in ('red', 'amber', 'green')),
  focus_area text not null default 'Pemantauan',
  source_hash text not null,
  prompt_version text not null default 'myspmcare-intervention-v1',
  provider text not null default 'local',
  model text not null default 'rule-fallback',
  suggestion jsonb not null,
  status text not null default 'generated' check (status in ('generated', 'approved', 'archived')),
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_ai_suggestions_source_idx
  on public.student_ai_suggestions (student_code, source_hash, prompt_version);

create index if not exists student_ai_suggestions_school_idx
  on public.student_ai_suggestions (school_code, created_at desc);

alter table public.student_ai_suggestions enable row level security;

drop policy if exists "school read ai suggestions" on public.student_ai_suggestions;
drop policy if exists "school create ai suggestions" on public.student_ai_suggestions;
drop policy if exists "school update ai suggestions" on public.student_ai_suggestions;

create policy "school read ai suggestions"
  on public.student_ai_suggestions for select
  to authenticated
  using (
    school_code is null
    or exists (
      select 1
      from public.app_user_access aur
      where aur.active = true
        and (
          aur.user_id = auth.uid()
          or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        and (
          aur.role::text = 'ppd_admin'
          or aur.school_code = student_ai_suggestions.school_code
        )
    )
  );

create policy "school create ai suggestions"
  on public.student_ai_suggestions for insert
  to authenticated
  with check (
    school_code is null
    or exists (
      select 1
      from public.app_user_access aur
      where aur.active = true
        and (
          aur.user_id = auth.uid()
          or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        and (
          aur.role::text = 'ppd_admin'
          or aur.school_code = student_ai_suggestions.school_code
        )
    )
  );

create policy "school update ai suggestions"
  on public.student_ai_suggestions for update
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_access aur
      where aur.active = true
        and (
          aur.user_id = auth.uid()
          or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        and aur.role::text in ('ppd_admin', 'school_admin', 'class_teacher', 'counsellor')
        and (
          student_ai_suggestions.school_code is null
          or aur.role::text = 'ppd_admin'
          or aur.school_code = student_ai_suggestions.school_code
        )
    )
  )
  with check (
    exists (
      select 1
      from public.app_user_access aur
      where aur.active = true
        and (
          aur.user_id = auth.uid()
          or lower(aur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        and aur.role::text in ('ppd_admin', 'school_admin', 'class_teacher', 'counsellor')
        and (
          student_ai_suggestions.school_code is null
          or aur.role::text = 'ppd_admin'
          or aur.school_code = student_ai_suggestions.school_code
        )
    )
  );

grant select, insert, update on public.student_ai_suggestions to authenticated;
